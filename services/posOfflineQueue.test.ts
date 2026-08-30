import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { posOfflineQueue } from './posOfflineQueue';

/**
 * Test hàng đợi offline của POS.
 *
 * Vì sao đáng test: đây là nơi giữ các thao tác người dùng làm khi mất mạng, và
 * bản vá `mergeBy` (SYNC-FORCE-RESURRECT-0819) đang DỰA HẲN vào nó — sau bản vá
 * đó, bản ghi chỉ được giữ lại trong cache nếu nó thực sự nằm trong hàng đợi này.
 * Nói cách khác, hàng đợi sai = dữ liệu nhân viên nhập lúc mất mạng biến mất.
 * Vậy mà file 308 dòng này trước đó không có một test nào (audit 2026-08-29).
 *
 * Trọng tâm là logic "gộp thao tác" (coalescing): khi cùng một bản ghi bị sửa
 * nhiều lần lúc offline, hàng đợi phải rút gọn về đúng trạng thái cuối cùng chứ
 * không phát lại từng bước — phát lại có thể dựng lại bản ghi đã xoá.
 *
 * `fake-indexeddb/auto` cung cấp IndexedDB cho môi trường node của vitest.
 */
describe('posOfflineQueue', () => {
  beforeEach(async () => {
    await posOfflineQueue.clearAll();
  });

  it('xếp hàng thao tác thường và đếm đúng', async () => {
    await posOfflineQueue.enqueue({
      opType: 'pushBatch',
      dataKey: 'expenses',
      payload: [{ id: 'e-1' }],
    });
    expect(await posOfflineQueue.count()).toBe(1);
    expect(await posOfflineQueue.countByDataKey('expenses')).toBe(1);
    expect(await posOfflineQueue.countByDataKey('posOrders')).toBe(0);
  });

  describe('gộp thao tác trên cùng một bản ghi', () => {
    it('sửa nhiều lần chỉ còn 1 mục, giữ trạng thái CUỐI CÙNG', async () => {
      const first = await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1', name: 'Tên cũ' },
      });
      const second = await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1', name: 'Tên mới' },
      });

      expect(second).toBe(first); // gộp vào đúng mục cũ, không tạo mục thứ hai
      const all = await posOfflineQueue.getAll();
      expect(all).toHaveLength(1);
      expect((all[0].payload as { name: string }).name).toBe('Tên mới');
    });

    it('xoá sau khi sửa → chỉ còn thao tác XOÁ', async () => {
      // Nếu giữ cả upsert lẫn delete rồi phát lại theo thứ tự, một lỗi thứ tự sẽ
      // dựng lại bản ghi đã xoá — đúng loại bug SYNC-FORCE-RESURRECT-0819.
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1', name: 'Sắp bị xoá' },
      });
      await posOfflineQueue.enqueue({
        opType: 'deleteItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1' },
      });

      const all = await posOfflineQueue.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].opType).toBe('deleteItem');
    });

    it('tạo lại sau khi xoá → chỉ còn thao tác GHI', async () => {
      await posOfflineQueue.enqueue({
        opType: 'deleteItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1' },
      });
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1', name: 'Nhập lại' },
      });

      const all = await posOfflineQueue.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].opType).toBe('upsertItem');
      expect((all[0].payload as { name: string }).name).toBe('Nhập lại');
    });

    it('xoá hai lần không tạo thêm mục thừa', async () => {
      const first = await posOfflineQueue.enqueue({
        opType: 'deleteItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1' },
      });
      const second = await posOfflineQueue.enqueue({
        opType: 'deleteItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1' },
      });

      expect(second).toBe(first);
      expect(await posOfflineQueue.count()).toBe(1);
    });

    it('KHÔNG gộp nhầm hai bản ghi khác id', async () => {
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'p-1' },
      });
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'p-2' },
      });
      expect(await posOfflineQueue.count()).toBe(2);
    });

    it('KHÔNG gộp nhầm cùng id nhưng khác bảng', async () => {
      // Cùng chuỗi id ở 2 bảng khác nhau là chuyện bình thường — gộp là mất dữ liệu.
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: 'trung-id' },
      });
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posCustomers',
        payload: { id: 'trung-id' },
      });
      expect(await posOfflineQueue.count()).toBe(2);
    });

    it('KHÔNG gộp thao tác hàng loạt (pushBatch) dù trùng dataKey', async () => {
      // pushBatch mang cả mảng, không có 1 id để so — gộp sẽ nuốt mất thao tác.
      await posOfflineQueue.enqueue({
        opType: 'pushBatch',
        dataKey: 'expenses',
        payload: [{ id: 'e-1' }],
      });
      await posOfflineQueue.enqueue({
        opType: 'pushBatch',
        dataKey: 'expenses',
        payload: [{ id: 'e-2' }],
      });
      expect(await posOfflineQueue.count()).toBe(2);
    });

    it('KHÔNG gộp khi payload không có id dùng được', async () => {
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { name: 'không có id' },
      });
      await posOfflineQueue.enqueue({
        opType: 'upsertItem',
        dataKey: 'posProducts',
        payload: { id: '   ' }, // id rỗng sau trim cũng không dùng được
      });
      expect(await posOfflineQueue.count()).toBe(2);
    });
  });

  it('remove xoá đúng một mục', async () => {
    const id = await posOfflineQueue.enqueue({
      opType: 'upsertItem',
      dataKey: 'posProducts',
      payload: { id: 'p-1' },
    });
    await posOfflineQueue.enqueue({
      opType: 'upsertItem',
      dataKey: 'posProducts',
      payload: { id: 'p-2' },
    });
    await posOfflineQueue.remove(id);

    const all = await posOfflineQueue.getAll();
    expect(all).toHaveLength(1);
    expect((all[0].payload as { id: string }).id).toBe('p-2');
  });

  it('incrementRetry tăng số lần thử và ghi lại lỗi cuối', async () => {
    const id = await posOfflineQueue.enqueue({
      opType: 'upsertItem',
      dataKey: 'posProducts',
      payload: { id: 'p-1' },
    });
    await posOfflineQueue.incrementRetry(id, 'mạng chập chờn');
    await posOfflineQueue.incrementRetry(id, 'vẫn chưa được');

    const all = await posOfflineQueue.getAll();
    expect(all[0].retries).toBe(2);
    expect(all[0].lastError).toBe('vẫn chưa được');
  });

  it('getAll trả về theo đúng thứ tự thời gian', async () => {
    await posOfflineQueue.enqueue({
      opType: 'pushBatch',
      dataKey: 'expenses',
      payload: [{ id: 'cu' }],
    });
    await new Promise(r => setTimeout(r, 5));
    await posOfflineQueue.enqueue({
      opType: 'pushBatch',
      dataKey: 'expenses',
      payload: [{ id: 'moi' }],
    });

    const all = await posOfflineQueue.getAll();
    expect(all[0].timestamp).toBeLessThanOrEqual(all[1].timestamp);
  });

  it('clearAll dọn sạch hàng đợi', async () => {
    await posOfflineQueue.enqueue({
      opType: 'upsertItem',
      dataKey: 'posProducts',
      payload: { id: 'p-1' },
    });
    await posOfflineQueue.clearAll();
    expect(await posOfflineQueue.count()).toBe(0);
  });
});
