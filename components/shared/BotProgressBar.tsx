import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminStoreRequest } from '../../services/adminStoreApi';

interface BotDescProgress {
    running: boolean;
    total: number;
    filled: number;
    failed: number;
    current: string | null;
}

interface BotStatus {
    slug: string;
    shop: string;
    ok: boolean;
    sync: { running: boolean };
    descriptions: BotDescProgress;
}

function DescBar({ filled, total }: { filled: number; total: number }) {
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    return (
        <div className="flex-1 bg-orange-400 rounded-full h-1.5 mx-2 min-w-[60px]">
            <div
                className="bg-white rounded-full h-1.5 transition-all duration-500"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

export function BotProgressBar() {
    const [bots, setBots] = useState<BotStatus[]>([]);

    useEffect(() => {
        let cancelled = false;
        let timerId: ReturnType<typeof setTimeout>;

        async function poll() {
            if (cancelled) return;
            try {
                // adminStoreRequest gắn JWT — fetch trần bị 401 trên prod (requireAuth)
                const data = await adminStoreRequest<{ bots?: BotStatus[] }>('/api/shopee-bot-status');
                if (!cancelled) setBots(data.bots ?? []);
            } catch {}
            if (!cancelled) timerId = setTimeout(poll, 15000);
        }

        poll();
        return () => {
            cancelled = true;
            clearTimeout(timerId);
        };
    }, []);

    const active = bots.filter(b => b.ok && (b.sync?.running || b.descriptions?.running));
    if (active.length === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-orange-500 shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
            {active.map(bot => {
                const d = bot.descriptions;
                const pct = d.total > 0 ? Math.round((d.filled / d.total) * 100) : 0;

                return (
                    <div key={bot.slug} className="flex items-center gap-2 px-4 py-1.5 text-white text-sm border-t border-orange-400 first:border-t-0">
                        <Loader2 className="animate-spin shrink-0" size={13} />
                        <span className="font-medium shrink-0">{bot.shop}</span>
                        <span className="text-orange-200 shrink-0">—</span>

                        {d.running ? (
                            <>
                                <span className="shrink-0">Lấy mô tả</span>
                                <DescBar filled={d.filled} total={d.total} />
                                <span className="shrink-0 tabular-nums text-xs">{pct}%</span>
                                <span className="shrink-0 text-orange-100 text-xs">({d.filled}/{d.total})</span>
                                {d.current && (
                                    <span className="text-orange-100 text-xs truncate max-w-[240px]">
                                        "{d.current}"
                                    </span>
                                )}
                            </>
                        ) : (
                            <span>Đang sync danh sách sản phẩm...</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
