import React from 'react';
import { AppDataSurgicalUpdate, ExpenseRecord, RecurringExpense } from '../../types';

interface UseExpenseRecurringArgs {
  list: ExpenseRecord[];
  recurringExpenses: RecurringExpense[];
  onUpdate: (newList: ExpenseRecord[], idToRemove?: string) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onUpdateRecurringExpenses: (newList: RecurringExpense[]) => void;
}

export const useExpenseRecurring = ({
  list,
  recurringExpenses,
  onUpdate,
  onUpdateSurgical,
  onUpdateRecurringExpenses
}: UseExpenseRecurringArgs) => {
  const [recurringForm, setRecurringForm] = React.useState<Partial<RecurringExpense>>({
    name: '',
    category: '',
    amount: 0,
    dayOfMonth: 1,
    isActive: true
  });

  const pendingRecurring = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentDay = now.getDate();

    return recurringExpenses.filter(recurring =>
      recurring.isActive &&
      recurring.lastPostedMonth !== currentMonth &&
      currentDay >= recurring.dayOfMonth
    );
  }, [recurringExpenses]);

  const handlePostRecurring = (recurring: RecurringExpense) => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const dateStr = `${currentMonth}-${String(recurring.dayOfMonth).padStart(2, '0')}`;

    const newExpense: ExpenseRecord = {
      id: crypto.randomUUID(),
      date: dateStr,
      category: recurring.category,
      amount: recurring.amount,
      description: `[Định kỳ] ${recurring.name}: ${recurring.description || ''}`
    };

    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'expenses', item: newExpense }]);
    } else {
      onUpdate([newExpense, ...list]);
    }

    const updatedRecurring = recurringExpenses.map(item =>
      item.id === recurring.id ? { ...item, lastPostedMonth: currentMonth } : item
    );
    onUpdateRecurringExpenses(updatedRecurring);
  };

  const handleAddRecurring = () => {
    if (!recurringForm.name || !recurringForm.category || !recurringForm.amount) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    const newRecurring: RecurringExpense = {
      id: crypto.randomUUID(),
      name: recurringForm.name,
      category: recurringForm.category,
      amount: Number(recurringForm.amount),
      dayOfMonth: Number(recurringForm.dayOfMonth) || 1,
      description: recurringForm.description,
      isActive: true
    };
    onUpdateRecurringExpenses([...recurringExpenses, newRecurring]);
    setRecurringForm({ name: '', category: '', amount: 0, dayOfMonth: 1, isActive: true });
  };

  const handleRemoveRecurring = (id: string) => {
    if (confirm('Xóa mẫu chi phí định kỳ này?')) {
      onUpdateRecurringExpenses(recurringExpenses.filter(recurring => recurring.id !== id));
    }
  };

  const toggleRecurringActive = (id: string) => {
    onUpdateRecurringExpenses(recurringExpenses.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item));
  };

  return {
    recurringForm,
    setRecurringForm,
    pendingRecurring,
    handlePostRecurring,
    handleAddRecurring,
    handleRemoveRecurring,
    toggleRecurringActive
  };
};
