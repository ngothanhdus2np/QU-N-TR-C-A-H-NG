import { useState, useEffect } from 'react';
import { Employee } from '../types';

interface StaffFormData {
  name: string;
  position: string;
  joinDate: string;
  assignedPolicyId: string;
  photoUrl: string;
  email: string;
  dob: string;
}

interface UseStaffManagerStateProps {
  requestedTab?: 'list' | 'performance' | 'ledger';
}

export function useStaffManagerState({ requestedTab }: UseStaffManagerStateProps = {}) {
  const [activeTab, setActiveTab] = useState<'list' | 'performance' | 'ledger'>('performance');

  const [formData, setFormData] = useState<StaffFormData>({
    name: '',
    position: 'Nhân viên',
    joinDate: new Date().toISOString().split('T')[0],
    assignedPolicyId: '',
    photoUrl: '',
    email: '',
    dob: '',
  });

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Sync activeTab with requestedTab prop
  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab]);

  // Helper: Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      position: 'Nhân viên',
      joinDate: new Date().toISOString().split('T')[0],
      assignedPolicyId: '',
      photoUrl: '',
      email: '',
      dob: '',
    });
    setEditingEmployee(null);
  };

  // Helper: Load employee into form for editing
  const loadEmployeeForEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name || '',
      position: employee.position || 'Nhân viên',
      joinDate: employee.joinDate || new Date().toISOString().split('T')[0],
      assignedPolicyId: employee.assignedPolicyId || '',
      photoUrl: employee.photoUrl || '',
      email: employee.email || '',
      dob: employee.dob || '',
    });
  };

  return {
    // State
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    editingEmployee,
    setEditingEmployee,
    
    // Helpers
    resetForm,
    loadEmployeeForEdit,
  };
}
