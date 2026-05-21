import React, { useState, useRef } from 'react';
import { 
  Package, Plus, Search, ArrowDownCircle, ClipboardCheck, X, Edit2, History, 
  Upload, FileDown, Star, Image as ImageIcon, Minus, FileText, 
  ChevronRight, ChevronLeft, ArrowLeft, Printer, Eye, Info, AlertCircle, ScanBarcode, Maximize2, 
  Grid3X3, User, Calendar, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { POSProduct, InventoryTransaction, Supplier } from '../../types';

interface GoodsInventoryProps {
  products: POSProduct[];
  transactions: InventoryTransaction[];
  suppliers?: Supplier[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: { key: any, item: any, isDelete?: boolean }[]) => Promise<void>;
  onPushBatch?: (key: any, items: any[]) => Promise<void>;
  onAddTransaction?: (transaction: InventoryTransaction) => void;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

const GoodsInventory: React.FC<GoodsInventoryProps> = ({ products, transactions, suppliers = [], onUpdateProducts, onUpdateSurgical, onPushBatch, onAddTransaction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };
  const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
  const [activeTab, setActiveTab] = useState<'goods' | 'purchase' | 'kho' | 'audit_form' | 'product_form' | 'suppliers'>('goods');
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{ productId: string; quantity: number; price: number; name: string; discount: number }[]>([]);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [purchaseNote, setPurchaseNote ] = useState('');

  // Supplier CRUD state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ name: '', phone: '', email: '', address: '', contactPerson: '', taxCode: '', notes: '', status: 'Active' });
  const [auditItems, setAuditItems] = useState<{ productId: string; currentStock: number; actualStock: number; note: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [activeFormTab, setActiveFormTab] = useState<'info' | 'desc' | 'warranty' | 'units'>('info');
  const [newAttrValue, setNewAttrValue] = useState<string>('');
  const [selectedAttrType, setSelectedAttrType] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Partial<POSProduct>>({
    name: '',
    sku: '',
    categoryId: '',
    brand: '',
    importPrice: 0,
    salePrice: 0,
    stock: 0,
    minStock: 0,
    maxStock: 999999999,
    unit: 'Cái',
    description: '',
    warranty: '',
    allowPoints: true,
    weight: 0,
    weightUnit: 'g',
    location: '',
    images: [],
    status: 'Active',
    units: [],
    attributes: []
  });

  const filteredProducts = React.useMemo(() => {
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return products.filter(p => 
      (p.name?.toLowerCase() || '').includes(lowerSearch) || 
      (p.sku?.toLowerCase() || '').includes(lowerSearch)
    );
  }, [products, debouncedSearchTerm]);

  const supplierOptions = React.useMemo(() => {
    if (!purchaseSupplier.trim()) return suppliers.filter(s => s.status === 'Active');
    const lower = purchaseSupplier.toLowerCase();
    return suppliers.filter(s => s.status === 'Active' && s.name.toLowerCase().includes(lower));
  }, [suppliers, purchaseSupplier]);

  const handleSaveSupplier = () => {
    if (!supplierForm.name?.trim()) { alert('Vui lòng nhập tên nhà cung cấp!'); return; }
    const item: Supplier = {
      id: editingSupplier?.id || generateId(),
      name: supplierForm.name!.trim(),
      phone: supplierForm.phone || undefined,
      email: supplierForm.email || undefined,
      address: supplierForm.address || undefined,
      contactPerson: supplierForm.contactPerson || undefined,
      taxCode: supplierForm.taxCode || undefined,
      notes: supplierForm.notes || undefined,
      status: supplierForm.status as 'Active' | 'Inactive' || 'Active'
    };
    if (onUpdateSurgical) onUpdateSurgical([{ key: 'posSuppliers', item }]);
    setEditingSupplier(null);
    setSupplierForm({ name: '', phone: '', email: '', address: '', contactPerson: '', taxCode: '', notes: '', status: 'Active' });
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('Xóa nhà cung cấp này?')) return;
    if (onUpdateSurgical) onUpdateSurgical([{ key: 'posSuppliers', item: { id }, isDelete: true }]);
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = React.useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProducts, currentPage]);

  const handleSaveProduct = (stayOnPage: boolean = false) => {
    if (!formData.name || !formData.sku) {
      alert('Vui lòng nhập tên và mã hàng!');
      return;
    }

    if (editingProduct) {
      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posProducts', item: { ...editingProduct, ...formData } as POSProduct }]);
      } else {
        onUpdateProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...formData } as POSProduct : p));
      }
    } else {
      const newProduct: POSProduct = { ...formData, id: generateId(), status: 'Active', categoryId: formData.categoryId || 'Chưa phân loại' } as POSProduct;
      if (onUpdateSurgical) {
        onUpdateSurgical([{ key: 'posProducts', item: newProduct }]);
      } else {
        onUpdateProducts([...products, newProduct]);
      }
      
      // If adding from Purchase tab, automatically add to current purchase items
      if (isQuickAddMode && activeTab === 'purchase') {
        handleAddProductToPurchase(newProduct);
      }
    }

    if (isQuickAddMode) {
      setShowProductModal(false);
      setIsQuickAddMode(false);
    } else if (!stayOnPage) {
      setActiveTab('goods');
    }
    
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      categoryId: '',
      brand: '',
      importPrice: 0,
      salePrice: 0,
      stock: 0,
      minStock: 0,
      maxStock: 999999999,
      unit: 'Cái',
      description: '',
      warranty: '',
      allowPoints: true,
      weight: 0,
      weightUnit: 'g',
      location: '',
      images: [],
      status: 'Active',
      units: [],
      attributes: []
    });

    if (stayOnPage) {
      alert('Đã lưu sản phẩm thành công. Bạn có thể nhập sản phẩm mới tiếp theo.');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectOne = React.useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleQuickStockUpdate = (p: POSProduct, type: 'Import' | 'Check') => {
    const amount = prompt(type === 'Import' ? 'Số lượng nhập thêm:' : 'Số lượng tồn thực tế:');
    if (amount === null || isNaN(Number(amount))) return;
    
    const qty = Number(amount);
    const prevStock = p.stock;
    const newStock = type === 'Import' ? prevStock + qty : qty;

    onUpdateProducts(products.map(item => item.id === p.id ? { ...item, stock: newStock } : item));

    if (onAddTransaction) {
      onAddTransaction({
        id: generateId(),
        date: new Date().toISOString(),
        type: type,
        staffId: 'Admin',
        items: [{
          productId: p.id,
          sku: p.sku,
          name: p.name,
          quantity: qty,
          previousStock: prevStock,
          newStock: newStock
        }],
        note: type === 'Import' ? 'Nhập hàng nhanh' : 'Kiểm kho định kỳ'
      });
    }
    alert('Cập nhật kho thành công!');
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const importedProducts: POSProduct[] = data.map((item: any) => {
          // Normalize keys to find matches regardless of case or spaces
          const findKey = (aliases: string[]) => {
            const keys = Object.keys(item);
            for (const alias of aliases) {
              const found = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
              if (found) return item[found];
            }
            return null;
          };

          return {
            id: generateId(),
            name: findKey(['Tên sản phẩm', 'Tên hàng', 'Ten hang', 'Name', 'Product Name']) || '',
            sku: String(findKey(['Mã hàng', 'Mã sản phẩm', 'Ma hang', 'SKU', 'Product Code']) || `SKU-${Date.now()}`),
            categoryId: findKey(['Nhóm hàng', 'Nhom hang', 'Loại hàng', 'Category']) || 'default',
            importPrice: Number(findKey(['Giá vốn', 'Gia von', 'Cost', 'Import Price']) || 0),
            salePrice: Number(findKey(['Giá bán', 'Gia ban', 'Price', 'Sale Price']) || 0),
            stock: Number(findKey(['Tồn kho', 'Ton kho', 'Stock', 'Quantity']) || 0),
            minStock: 0,
            unit: findKey(['Đơn vị', 'Don vi', 'Đơn vị tính', 'Unit']) || 'Cái',
            status: 'Active' as const
          };
        }).filter(p => p.name !== '');

        if (onPushBatch) {
          await onPushBatch('posProducts', importedProducts);
        } else {
          onUpdateProducts([...products, ...importedProducts]);
        }
        alert(`Đã tải lên thành công ${importedProducts.length} sản phẩm!`);
      } catch (err: any) {
        console.error("Excel Import Error:", err);
        alert(`Lỗi khi xử lý dữ liệu: ${err.message || 'Kiểm tra định dạng file'}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ 'Tên sản phẩm': 'Mẫu', 'Mã hàng': 'SKU001', 'Giá vốn': 50000, 'Giá bán': 100000, 'Tồn kho': 10 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau");
    XLSX.writeFile(wb, "Mau_Import.xlsx");
  };

  const handleAddProductToPurchase = (p: POSProduct) => {
    const existing = purchaseItems.find(item => item.productId === p.id);
    if (existing) {
      setPurchaseItems(prev => prev.map(item => 
        item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setPurchaseItems(prev => [...prev, {
        productId: p.id,
        quantity: 1,
        price: p.importPrice,
        name: p.name,
        discount: 0
      }]);
    }
  };

  const updatePurchaseItem = (id: string, updates: Partial<{ quantity: number; price: number; discount: number }>) => {
    setPurchaseItems(prev => prev.map(item => item.productId === id ? { ...item, ...updates } : item));
  };

  const removePurchaseItem = (id: string) => {
    setPurchaseItems(prev => prev.filter(item => item.productId !== id));
  };

  const handleCompletePurchase = () => {
    if (purchaseItems.length === 0) return;
    const updatedProducts = [...products];
    const itemsForTransaction: any[] = [];
    
    purchaseItems.forEach(item => {
      const idx = updatedProducts.findIndex(p => p.id === item.productId);
      if (idx !== -1) {
        const p = updatedProducts[idx];
        itemsForTransaction.push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          quantity: item.quantity,
          previousStock: p.stock,
          newStock: p.stock + item.quantity,
          price: item.price
        });
        updatedProducts[idx] = { ...p, stock: p.stock + item.quantity, importPrice: item.price };
      }
    });

    onUpdateProducts(updatedProducts);
    if (onAddTransaction) {
      onAddTransaction({
        id: generateId(),
        date: new Date().toISOString(),
        type: 'Import',
        staffId: 'Admin',
        items: itemsForTransaction,
        note: purchaseNote || `Nhập hàng từ ${purchaseSupplier || 'NCC vãng lai'}`,
        supplierName: purchaseSupplier || undefined,
      });
    }
    alert('Nhập hàng thành công!');
    setPurchaseItems([]);
    setPurchaseSupplier('');
    setPurchaseNote('');
    setShowPurchaseForm(false);
  };

  const handleConfirmAudit = () => {
    const updatedProducts = [...products];
    const itemsForTransaction: any[] = [];
    auditItems.forEach(audit => {
      const idx = updatedProducts.findIndex(p => p.id === audit.productId);
      if (idx !== -1) {
        const p = updatedProducts[idx];
        itemsForTransaction.push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          quantity: audit.actualStock - audit.currentStock,
          previousStock: audit.currentStock,
          newStock: audit.actualStock
        });
        updatedProducts[idx] = { ...p, stock: audit.actualStock };
      }
    });
    onUpdateProducts(updatedProducts);
    if (onAddTransaction) {
      onAddTransaction({ id: generateId(), date: new Date().toISOString(), type: 'Check', staffId: 'Admin', items: itemsForTransaction, note: 'Kiểm kho' });
    }
    setAuditItems([]);
    setActiveTab('kho');
  };

  const addBaseUnit = () => {
    const unitName = prompt('Tên đơn vị cơ bản:');
    if (unitName) setFormData({...formData, unit: unitName, units: [{ id: generateId(), name: unitName, factor: 1, price: formData.salePrice || 0, isBase: true }]});
  };

  const addConversionUnit = () => {
    const name = prompt('Tên đơn vị quy đổi:');
    const factor = prompt('Hệ số quy đổi:');
    if (name && factor) setFormData({...formData, units: [...(formData.units || []), { id: generateId(), name, factor: Number(factor), price: (formData.salePrice || 0) * Number(factor), isBase: false }]});
  };

  const addAttribute = () => {
    if (selectedAttrType && newAttrValue) {
      setFormData({...formData, attributes: [...(formData.attributes || []), { id: generateId(), name: selectedAttrType, values: newAttrValue.split(',').map(v => v.trim()) }]});
      setSelectedAttrType('');
      setNewAttrValue('');
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case 'goods':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl"><Package className="w-5 h-5" /></div>
                  <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Danh mục</div>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Tổng mặt hàng</div>
                <div className="text-3xl font-black text-slate-900 tracking-tighter">{products.length} <span className="text-xs font-bold text-slate-300 ml-1 tracking-normal">SKUs</span></div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                   <div className="p-3.5 bg-indigo-50 text-indigo-500 rounded-2xl"><FileDown className="w-5 h-5" /></div>
                   <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tài chính</div>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Giá trị tồn kho</div>
                <div className="text-3xl font-black text-indigo-600 tracking-tighter">{products.reduce((acc, p) => acc + (p.importPrice * p.stock), 0).toLocaleString()} <span className="text-xs font-bold text-indigo-300 ml-0.5">đ</span></div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                   <div className="p-3.5 bg-rose-50 text-rose-500 rounded-2xl"><AlertCircle className="w-5 h-5" /></div>
                   <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cảnh báo</div>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Sắp hết hàng</div>
                <div className="text-3xl font-black text-rose-600 tracking-tighter">{products.filter(p => p.stock <= (p.minStock || 5)).length} <span className="text-xs font-bold text-rose-300 ml-1 tracking-normal">mẫu</span></div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                   <div className="p-3.5 bg-emerald-50 text-emerald-500 rounded-2xl"><ClipboardCheck className="w-5 h-5" /></div>
                   <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Vận hành</div>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Giao dịch kho</div>
                <div className="text-3xl font-black text-emerald-600 tracking-tighter">{transactions.length} <span className="text-xs font-bold text-emerald-300 ml-1 tracking-normal">lượt</span></div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="p-6 w-12 text-center text-slate-400 uppercase text-[9px] tracking-widest border-r border-slate-100">
                        <input type="checkbox" className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} />
                      </th>
                      <th className="p-6 text-left font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Mã hàng</th>
                      <th className="p-6 text-left font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Tên hàng hóa</th>
                      <th className="p-6 text-left font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Nhóm ngành</th>
                      <th className="p-6 text-right font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Giá bán lẻ</th>
                      <th className="p-6 text-right font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Giá nhập</th>
                      <th className="p-6 text-left font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Thương hiệu</th>
                      <th className="p-6 text-right font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Tồn kho</th>
                      <th className="p-6 text-center font-black text-[10px] uppercase tracking-widest text-slate-500 whitespace-nowrap">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentProducts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-10 text-center py-20 italic text-slate-400 border-none">
                          <Package className="h-10 w-10 mx-auto mb-4 opacity-10" />
                          Không có dữ liệu hàng hóa phù hợp
                        </td>
                      </tr>
                    ) : (
                      currentProducts.map(p => (
                        <ProductRow 
                          key={p.id} 
                          product={p} 
                          isSelected={selectedIds.includes(p.id)} 
                          onSelect={toggleSelectOne} 
                          onEdit={(prod) => { setEditingProduct(prod); setFormData(prod); setActiveTab('product_form'); }} 
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} items
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum = currentPage;
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        
                        if (pageNum < 1 || pageNum > totalPages) return null;

                        return (
                          <button 
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600'}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'purchase':
        return (
          <div className="h-full flex flex-col -m-6 bg-[#f0f2f5]">
            {showPurchaseForm ? (
              <div className="flex h-screen overflow-hidden">
                {/* Main Content Area */}
                <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
                  {/* Purchase Header */}
                  <div className="bg-white border-b px-4 py-2 flex items-center gap-4 z-10">
                    <button onClick={() => setShowPurchaseForm(false)} className="p-2 hover:bg-slate-100 rounded-full">
                      <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <h1 className="text-xl font-bold whitespace-nowrap">Nhập hàng</h1>
                    
                    <div className="flex-1 max-w-2xl relative">
                      <div className={`flex items-center bg-white border ${searchFocused ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' : 'border-slate-200'} rounded-md px-3 py-1.5 transition-all`}>
                        <Search className="h-4 w-4 text-slate-400 mr-2" />
                        <input 
                          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-400" 
                          placeholder="Tìm hàng hóa theo mã hoặc tên (F3)" 
                          onFocus={() => setSearchFocused(true)}
                          onBlur={() => setSearchFocused(false)}
                          value={purchaseSearchTerm}
                          onChange={e => setPurchaseSearchTerm(e.target.value)}
                        />
                        <div className="flex items-center gap-1.5 ml-2 border-l pl-2 border-slate-100">
                          <Plus 
                            className="h-4 w-4 text-slate-400 cursor-pointer hover:text-indigo-600" 
                            onClick={() => { 
                              setEditingProduct(null); 
                              setFormData({
                                name: '',
                                sku: `HH-${Date.now().toString().slice(-6)}`,
                                categoryId: '',
                                brand: '',
                                importPrice: 0,
                                salePrice: 0,
                                stock: 0,
                                minStock: 0,
                                maxStock: 999999999,
                                unit: 'Cái',
                                description: '',
                                warranty: '',
                                allowPoints: true,
                                weight: 0,
                                weightUnit: 'g',
                                location: '',
                                images: [],
                                status: 'Active',
                                units: [],
                                attributes: []
                              });
                              setIsQuickAddMode(true); 
                              setShowProductModal(true); 
                            }}
                          />
                        </div>
                      </div>

                      {/* Search Results Dropdown remains same */}
                      {purchaseSearchTerm && searchFocused && (
                        <div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-b-lg mt-1 z-50 max-h-[400px] overflow-y-auto">
                           {products.filter(p => p.name.toLowerCase().includes(purchaseSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(purchaseSearchTerm.toLowerCase())).map(p => (
                             <div 
                               key={p.id} 
                               onMouseDown={(e) => { e.preventDefault(); handleAddProductToPurchase(p); setPurchaseSearchTerm(''); }}
                               className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                             >
                               <div>
                                 <div className="text-sm font-bold text-slate-800">{p.name}</div>
                                 <div className="text-xs text-slate-500">{p.sku} | Tồn: <span className="font-bold text-indigo-600">{p.stock}</span></div>
                               </div>
                               <div className="text-sm font-black text-slate-900">{p.importPrice.toLocaleString()}đ</div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Purchase Table Area */}
                  <div className="flex-1 overflow-auto bg-white relative">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-[#f0f7ff] sticky top-0 z-10">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-center font-semibold text-slate-700 w-10 border-r"></th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 w-12 border-r">STT</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 w-32 border-r">Mã hàng</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r">Tên hàng</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 w-24 border-r">ĐVT</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700 w-28 border-r">Số lượng</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700 w-32 border-r">Đơn giá</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700 w-28 border-r">Giảm giá</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700 w-32">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-20 text-center">
                              <div className="flex flex-col items-center justify-center space-y-4">
                                <h3 className="text-xl font-bold text-slate-800">Thêm sản phẩm từ file excel</h3>
                                <p className="text-sm text-slate-500">(Tải về file mẫu: <span onClick={downloadTemplate} className="text-indigo-600 cursor-pointer hover:underline">Excel file</span>)</p>
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md font-bold transition-all hover:bg-indigo-700 shadow-md"
                                >
                                  <Upload className="h-5 w-5" />
                                  Chọn file dữ liệu
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          purchaseItems.map((item, idx) => (
                            <tr key={item.productId} className="border-b hover:bg-slate-50 group">
                              <td className="px-3 py-2 text-center border-r">
                                <button 
                                  onClick={() => removePurchaseItem(item.productId)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                              <td className="px-3 py-2 text-slate-500 border-r text-center">{idx + 1}</td>
                              <td className="px-3 py-2 font-mono text-indigo-600 border-r">{products.find(p => p.id === item.productId)?.sku}</td>
                              <td className="px-3 py-2 font-medium border-r">{item.name}</td>
                              <td className="px-3 py-2 border-r">{products.find(p => p.id === item.productId)?.unit || 'Cái'}</td>
                              <td className="px-3 py-2 border-r">
                                <div className="flex items-center border rounded overflow-hidden">
                                  <button onClick={() => updatePurchaseItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })} className="px-2 py-1 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                  <input 
                                    type="number" 
                                    className="w-full text-center py-1 outline-none font-bold" 
                                    value={item.quantity} 
                                    onChange={e => updatePurchaseItem(item.productId, { quantity: Number(e.target.value) })} 
                                  />
                                  <button onClick={() => updatePurchaseItem(item.productId, { quantity: item.quantity + 1 })} className="px-2 py-1 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                                </div>
                              </td>
                              <td className="px-3 py-2 border-r">
                                <input 
                                  type="number" 
                                  className="w-full text-right outline-none bg-transparent font-bold" 
                                  value={item.price} 
                                  onChange={e => updatePurchaseItem(item.productId, { price: Number(e.target.value) })}
                                />
                              </td>
                              <td className="px-3 py-2 border-r">
                                <input 
                                  type="number" 
                                  className="w-full text-right outline-none bg-transparent" 
                                  value={item.discount}
                                  onChange={e => updatePurchaseItem(item.productId, { discount: Number(e.target.value) })}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-black text-indigo-600">
                                {(item.quantity * item.price - item.discount).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Sidebar Toggle Button */}
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white border shadow-md rounded-full p-1.5 hover:bg-indigo-50 transition-all text-indigo-600"
                  >
                    {isSidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </button>
                </div>

                {/* Right Sidebar */}
                <div className={`${isSidebarOpen ? 'w-[360px]' : 'w-0'} bg-white border-l transition-all duration-300 flex flex-col h-full overflow-hidden`}>
                  <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    {/* User Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100 transition-all">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <User className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold truncate max-w-[120px]">Ngô Thành Du</span>
                        <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('vi-VN')}</div>
                        <div className="text-xs text-slate-500 font-medium">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>

                    {/* Supplier */}
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            className="w-full pl-10 pr-4 py-2 border rounded-md text-sm outline-none focus:border-indigo-500 transition-all"
                            placeholder="Tìm nhà cung cấp"
                            value={purchaseSupplier}
                            onChange={e => { setPurchaseSupplier(e.target.value); setShowSupplierDropdown(true); }}
                            onFocus={() => setShowSupplierDropdown(true)}
                            onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)}
                          />
                          {showSupplierDropdown && supplierOptions.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                              {supplierOptions.map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                                  onMouseDown={() => { setPurchaseSupplier(s.name); setShowSupplierDropdown(false); }}
                                >
                                  <div className="text-sm font-bold text-slate-800">{s.name}</div>
                                  {s.phone && <div className="text-xs text-slate-400">{s.phone}</div>}
                                </button>
                              ))}
                            </div>
                          )}
                          {showSupplierDropdown && supplierOptions.length === 0 && purchaseSupplier.trim() && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 text-xs text-slate-400">
                              Không tìm thấy nhà cung cấp. Vào tab <span className="font-bold text-indigo-600">Nhà cung cấp</span> để thêm mới.
                            </div>
                          )}
                        </div>
                        <button
                          className="p-2 border rounded-md hover:bg-slate-50 text-indigo-600 transition-all"
                          title="Quản lý nhà cung cấp"
                          onClick={() => setActiveTab('suppliers')}
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Mã phiếu nhập</span>
                        <input className="text-right text-sm border-b border-dashed outline-none focus:border-indigo-500 font-medium" placeholder="Mã phiếu tự động" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Mã đặt hàng nhập</span>
                        <input className="text-right text-sm border-b border-dashed outline-none focus:border-indigo-500 font-medium" placeholder="Nhập mã đặt hàng" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Trạng thái</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Phiếu tạm</span>
                      </div>
                    </div>

                    <div className="border-t pt-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                          Tổng tiền hàng <Info className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <span className="text-lg font-black text-slate-900">{purchaseItems.reduce((s, i) => s + (i.quantity * i.price), 0).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">Chiết khấu phiếu</span>
                        <input 
                          type="number" 
                          className="text-right text-base font-bold bg-slate-50 border rounded px-3 py-1.5 w-32 outline-none focus:border-indigo-500 transition-all" 
                          defaultValue={0} 
                        />
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t mt-4">
                        <span className="text-sm font-bold text-slate-700">Cần trả nhà cung cấp</span>
                        <span className="text-xl font-black text-indigo-600">
                          {purchaseItems.reduce((s, i) => s + (i.quantity * i.price - i.discount), 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <textarea 
                        className="w-full p-3 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-indigo-500 transition-all min-h-[100px] outline-none" 
                        placeholder="Ghi chú"
                        value={purchaseNote} 
                        onChange={e => setPurchaseNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-white border-t mt-auto grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => alert('Đã lưu bản nháp!')}
                      className="py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-black uppercase text-sm hover:bg-indigo-50 transition-all"
                    >
                      Lưu tạm
                    </button>
                    <button 
                      onClick={handleCompletePurchase} 
                      className="py-3 bg-indigo-600 text-white rounded-lg font-black uppercase text-sm hover:bg-indigo-700 shadow-md transition-all"
                    >
                      Hoàn thành
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-sm font-black uppercase flex items-center gap-2"><History className="h-4 w-4 text-indigo-500" /> Lịch sử nhập hàng</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f8fafc] border-b font-black text-[11px] uppercase text-slate-700">
                      <tr><th className="p-4 text-left">Mã đơn</th><th className="p-4 text-left">Ngày nhập</th><th className="p-4 text-left">Nhà cung cấp</th><th className="p-4 text-right">Giá trị</th><th className="p-4 text-left">Ghi chú</th></tr>
                    </thead>
                    <tbody>
                      {transactions.filter(t => t.type === 'Import').map(t => (
                        <tr key={t.id} className="border-b transition-colors hover:bg-slate-50">
                          <td className="p-4 font-mono font-bold text-indigo-600">{t.id.slice(0, 8)}</td>
                          <td className="p-4 text-slate-500">{new Date(t.date).toLocaleString('vi-VN')}</td>
                          <td className="p-4 font-bold">{t.note?.split('từ ')[1] || '---'}</td>
                          <td className="p-4 text-right font-black text-emerald-600">{t.items.reduce((s, i) => s + (i.quantity * (i.price || 0)), 0).toLocaleString()}đ</td>
                          <td className="p-4 text-slate-400 text-xs italic">{t.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case 'kho':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#fff9f0] border-b font-black uppercase text-[10px]">
                <tr><th className="p-4 text-left">Mã phiếu</th><th className="p-4 text-left">Ngày</th><th className="p-4 text-right">Lệch</th><th className="p-4 text-center">Trạng thái</th></tr>
              </thead>
              <tbody>
                {transactions.filter(t => t.type === 'Check').map(t => (
                  <tr key={t.id} className="border-b"><td className="p-4 font-mono text-indigo-600 font-black">#{t.id.slice(0,8)}</td><td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td><td className="p-4 text-right font-black">{t.items.reduce((s, i) => s + i.quantity, 0)}</td><td className="p-4 text-center"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase">Đã cân bằng</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'audit_form':
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
            <h3 className="font-bold text-lg mb-4">Phiếu kiểm kê</h3>
            <div className="relative mb-4">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
               <input className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg" placeholder="Tìm hàng kiểm..." value={auditSearchTerm} onChange={e => {
                 setAuditSearchTerm(e.target.value);
                 const p = products.find(p => p.name.includes(e.target.value) || p.sku.includes(e.target.value));
                 if (p && !auditItems.find(i => i.productId === p.id)) setAuditItems([...auditItems, { productId: p.id, currentStock: p.stock, actualStock: p.stock, note: '' }]);
               }} />
            </div>
            <div className="flex-1 overflow-y-auto">
               <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b uppercase text-[10px] font-black"><tr><th className="p-3 text-left">Sản phẩm</th><th className="p-3 text-right">Tồn HT</th><th className="p-3 text-center">Thực tế</th><th></th></tr></thead>
                  <tbody>
                    {auditItems.map((item, idx) => (
                      <tr key={idx} className="border-b"><td className="p-3">{products.find(p => p.id === item.productId)?.name}</td><td className="p-3 text-right font-bold">{item.currentStock}</td><td className="p-3 text-center"><input type="number" className="w-16 text-center border rounded" value={item.actualStock} onChange={e => { const nl = [...auditItems]; nl[idx].actualStock = Number(e.target.value); setAuditItems(nl); }} /></td><td><button onClick={() => setAuditItems(auditItems.filter(i => i.productId !== item.productId))}><X className="h-4 w-4 text-slate-300" /></button></td></tr>
                    ))}
                  </tbody>
               </table>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t">
               <button onClick={() => setActiveTab('kho')} className="px-4 py-2 bg-slate-100 rounded-lg font-black text-xs uppercase">Hủy</button>
               <button onClick={handleConfirmAudit} className="px-4 py-2 bg-amber-500 text-white rounded-lg font-black text-xs uppercase">Xác nhận lệch</button>
            </div>
          </div>
        );
      case 'product_form':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                    <Package className="w-7 h-7" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingProduct ? 'Cập nhật mẫu hàng' : 'Thêm hàng hóa mới'}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hệ thống quản lý kho vận chuyên sâu CFO Brain</p>
                 </div>
              </div>
              <div className="flex gap-4 mt-6 md:mt-0">
                <button onClick={() => setActiveTab('goods')} className="px-8 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors">Hủy thao tác</button>
                <button onClick={() => handleSaveProduct(false)} className="px-10 py-4 bg-slate-950 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-slate-950/20 active:scale-95 transition-all hover:bg-indigo-600">Xác nhận lưu</button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* COLUMN 1: IDENTIFICATION */}
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-8">
                  <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3 italic">Mã định danh & Tài chính</h3>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Tên sản phẩm *</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:border-indigo-400 transition-all outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="V.d: GIÀY NIKE AIR JORDAN 1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Mã SKU *</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-indigo-600 font-black focus:bg-white focus:border-indigo-400 transition-all outline-none text-sm" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Giá nhập kho</label>
                      <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right font-black text-slate-800 focus:bg-white focus:border-indigo-400 transition-all outline-none" value={formData.importPrice} onChange={e => setFormData({...formData, importPrice: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Giá niêm yết bán lẻ</label>
                    <div className="relative">
                       <input type="number" className="w-full pl-8 pr-8 py-6 bg-indigo-50 border-indigo-100 border-2 rounded-[2rem] text-right font-black text-indigo-600 text-3xl tabular-nums focus:bg-white transition-all outline-none shadow-inner" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-8">
                  <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3 italic">Thiết lập định mức kho</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4 shadow-sm p-4 rounded-2xl border border-slate-50">
                       <label className="text-[10px] font-black uppercase text-slate-500 block text-center tracking-widest">Tồn hiện tại</label>
                       <input type="number" disabled={!!editingProduct} className="w-full py-2 bg-transparent text-center font-black text-2xl text-slate-900 tabular-nums outline-none disabled:opacity-50" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-4 shadow-sm p-4 rounded-2xl border border-rose-50">
                       <label className="text-[10px] font-black uppercase text-rose-400 block text-center tracking-widest">Tồn tối thiểu</label>
                       <input type="number" className="w-full py-2 bg-transparent text-center font-black text-2xl text-rose-500 tabular-nums outline-none" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: CLASSIFICATION & VARIATIONS */}
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-8">
                  <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3 italic">Đặc tính & Phân loại</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Nhóm ngành</label>
                       <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white transition-all uppercase text-xs tracking-tighter" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} placeholder="V.D: GIÀY THỂ THAO" />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Thương hiệu</label>
                       <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white transition-all uppercase text-xs tracking-tighter" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="V.D: ADIDAS" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Khu vực lưu trữ</label>
                       <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white transition-all uppercase text-xs tracking-tighter" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="KỆ A2-B1" />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Đơn vị tính</label>
                       <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white transition-all uppercase text-xs tracking-tighter" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="V.D: ĐÔI" />
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-100">
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-4 block tracking-widest">Thuộc tính biến thể (Màu, Size...)</label>
                    <div className="flex gap-3 mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <select className="flex-1 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase p-3 outline-none" value={selectedAttrType} onChange={e => setSelectedAttrType(e.target.value)}>
                        <option value="">Chọn phân loại</option>
                        <option value="Màu sắc">Màu sắc</option>
                        <option value="Kích thước">Kích thước</option>
                        <option value="Chất liệu">Chất liệu</option>
                        <option value="Khác">Khác...</option>
                      </select>
                      <input className="flex-[2] bg-white border border-slate-200 rounded-xl text-xs font-bold p-3 outline-none focus:border-indigo-400" placeholder="Giá trị..." value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)} />
                      <button onClick={addAttribute} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-slate-950 transition-all"><Plus className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                       {formData.attributes?.map(attr => (
                         <div key={attr.id} className="bg-white border-2 border-indigo-100 px-4 py-2.5 rounded-2xl shadow-sm animate-in zoom-in-95">
                            <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-50 pb-1 mb-2">{attr.name}</div>
                            <div className="flex flex-wrap gap-2">
                               {attr.values.map((v, i) => <span key={i} className="text-[10px] font-black text-indigo-950 uppercase">{v}{i < attr.values.length - 1 ? ',' : ''}</span>)}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 3: MEDIA & DESCRIPTIONS */}
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-8">
                  <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3 italic">Hình ảnh & Truyền thông</h3>
                  <div className="aspect-video bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 group hover:border-indigo-400 transition-all cursor-pointer relative overflow-hidden">
                     {formData.images?.[0] ? (
                       <>
                        <img src={formData.images[0]} className="w-full h-full object-cover absolute inset-0" alt="Sản phẩm" />
                        <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Edit2 className="text-white w-8 h-8" />
                        </div>
                       </>
                     ) : (
                       <>
                        <ImageIcon className="w-12 h-12 text-slate-200 mb-4 group-hover:text-indigo-300 transition-colors" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tải lên hình ảnh sản phẩm thực tế</p>
                       </>
                     )}
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Mô tả sản phẩm (Chiến lược nội dung)</label>
                    <textarea className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-medium text-slate-700 focus:bg-white transition-all outline-none min-h-[160px] placeholder:text-slate-300" placeholder="Thông tin chi tiết về chất liệu, nguồn gốc và các lưu ý sử dụng hàng hóa..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'suppliers':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            {editingSupplier !== null ? (
              <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 p-10 max-w-2xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black text-slate-900">{editingSupplier.id ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h2>
                  <button onClick={() => setEditingSupplier(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tên nhà cung cấp *</label>
                    <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.name || ''} onChange={e => setSupplierForm(f => ({...f, name: e.target.value}))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Điện thoại</label>
                    <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.phone || ''} onChange={e => setSupplierForm(f => ({...f, phone: e.target.value}))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Email</label>
                    <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.email || ''} onChange={e => setSupplierForm(f => ({...f, email: e.target.value}))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Người liên hệ</label>
                    <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.contactPerson || ''} onChange={e => setSupplierForm(f => ({...f, contactPerson: e.target.value}))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Mã số thuế</label>
                    <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.taxCode || ''} onChange={e => setSupplierForm(f => ({...f, taxCode: e.target.value}))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Địa chỉ</label>
                    <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.address || ''} onChange={e => setSupplierForm(f => ({...f, address: e.target.value}))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ghi chú</label>
                    <textarea className="w-full p-3 bg-slate-50 border rounded-xl font-medium outline-none focus:border-indigo-500 min-h-[80px]" value={supplierForm.notes || ''} onChange={e => setSupplierForm(f => ({...f, notes: e.target.value}))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Trạng thái</label>
                    <select className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-indigo-500" value={supplierForm.status || 'Active'} onChange={e => setSupplierForm(f => ({...f, status: e.target.value as 'Active' | 'Inactive'}))}>
                      <option value="Active">Đang hợp tác</option>
                      <option value="Inactive">Ngừng hợp tác</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditingSupplier(null)} className="flex-1 py-3 border-2 rounded-xl font-black text-xs uppercase hover:bg-slate-50 transition-all">Hủy</button>
                  <button onClick={handleSaveSupplier} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Lưu nhà cung cấp</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Nhà cung cấp</h2>
                    <p className="text-sm text-slate-400 mt-1">{suppliers.length} nhà cung cấp</p>
                  </div>
                  <button
                    onClick={() => { setEditingSupplier({ id: '', name: '', status: 'Active' }); setSupplierForm({ name: '', phone: '', email: '', address: '', contactPerson: '', taxCode: '', notes: '', status: 'Active' }); }}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-950 transition-all"
                  >
                    + Thêm nhà cung cấp
                  </button>
                </div>
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
                  {suppliers.length === 0 ? (
                    <div className="p-16 text-center text-slate-400">
                      <User className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                      <p className="font-bold">Chưa có nhà cung cấp nào</p>
                      <p className="text-sm mt-1">Nhấn "+ Thêm nhà cung cấp" để bắt đầu</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tên NCC</th>
                          <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Điện thoại</th>
                          <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Người liên hệ</th>
                          <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                          <th className="p-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map(s => (
                          <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-all">
                            <td className="p-5">
                              <div className="font-bold text-slate-900">{s.name}</div>
                              {s.email && <div className="text-xs text-slate-400">{s.email}</div>}
                            </td>
                            <td className="p-5 font-medium text-slate-600">{s.phone || '---'}</td>
                            <td className="p-5 text-slate-600">{s.contactPerson || '---'}</td>
                            <td className="p-5">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {s.status === 'Active' ? 'Đang hợp tác' : 'Ngừng'}
                              </span>
                            </td>
                            <td className="p-5 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, contactPerson: s.contactPerson, taxCode: s.taxCode, notes: s.notes, status: s.status }); }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSupplier(s.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {activeTab !== 'audit_form' && (
        <div className="flex bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 w-fit mb-8 gap-1">
          <button onClick={() => setActiveTab('goods')} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'goods' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>Danh mục hàng</button>
          <button onClick={() => { setActiveTab('purchase'); setShowPurchaseForm(false); }} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'purchase' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>Nhập hàng (F2)</button>
          <button onClick={() => setActiveTab('kho')} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'kho' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>Số dư tồn kho</button>
          <button onClick={() => { setActiveTab('suppliers'); setEditingSupplier(null); }} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'suppliers' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>Nhà cung cấp</button>
        </div>
      )}

      {activeTab !== 'product_form' && activeTab !== 'audit_form' && activeTab !== 'suppliers' && (
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 gap-6 mb-8">
           <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
              <input type="text" placeholder="Tìm hàng hóa, mã SKU..." className="w-full pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl outline-none text-sm font-bold border border-slate-200 focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-300 shadow-inner" value={searchTerm} onChange={e => handleSearchChange(e.target.value)} />
           </div>
            <div className="flex gap-3 w-full md:w-auto">
              {activeTab === 'goods' && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none px-6 py-3.5 bg-white border border-slate-200 text-slate-800 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm">
                    <Upload className="h-4 w-4 text-slate-400" /> Tải lên Excel
                  </button>
                  <button onClick={() => { setActiveTab('product_form'); setEditingProduct(null); }} className="flex-1 md:flex-none px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-950 transition-all">+ Tạo mới hàng hóa</button>
                </>
              )}
              {activeTab === 'purchase' && !showPurchaseForm && <button onClick={() => setShowPurchaseForm(true)} className="flex-1 md:flex-none px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-slate-950 transition-all">+ Lập phiếu nhập</button>}
              {activeTab === 'kho' && <button onClick={() => setActiveTab('audit_form')} className="flex-1 md:flex-none px-8 py-3.5 bg-amber-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-amber-100 hover:bg-slate-950 transition-all">+ Kiểm kê thực tế</button>}
            </div>
        </div>
      )}

      {renderMainContent()}

      {/* Quick Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-50 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-white border-b flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                Thêm hàng hóa nhanh vào phiếu nhập
              </h2>
              <button 
                onClick={() => { setShowProductModal(false); setIsQuickAddMode(false); }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* Reuse product form layout */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* COPIED FROM product_form case for consistency */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                      <h3 className="font-black text-[10px] uppercase text-slate-400 flex items-center gap-2 italic"><Package className="h-3 w-3" /> Định danh & Tài chính</h3>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Tên sản phẩm *</label>
                        <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Mã SKU *</label>
                          <input className="w-full p-2 bg-slate-50 border rounded-lg font-mono text-indigo-600 font-bold outline-none focus:border-indigo-500" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Giá nhập</label>
                          <input type="number" className="w-full p-2 bg-slate-50 border rounded-lg text-right font-black outline-none focus:border-indigo-500" value={formData.importPrice} onChange={e => setFormData({...formData, importPrice: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Giá bán lẻ</label>
                        <input type="number" className="w-full p-3 bg-indigo-50 border-indigo-100 border rounded-xl text-right font-black text-indigo-600 text-lg outline-none" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                      <h3 className="font-black text-[10px] uppercase text-slate-400 flex items-center gap-2 italic"><History className="h-3 w-3" /> Phân loại & Quy cách</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Nhóm hàng</label><input className="w-full p-2 bg-slate-50 border rounded-lg outline-none" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} placeholder="V.d: Mỹ phẩm" /></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Thương hiệu</label><input className="w-full p-2 bg-slate-50 border rounded-lg outline-none" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="V.d: Nike" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Đơn vị tính</label><input className="w-full p-2 bg-slate-50 border rounded-lg outline-none" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Tồn hiện tại</label><input type="number" className="w-full p-2 bg-slate-50 border rounded-lg text-right font-bold outline-none" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                      <h3 className="font-black text-[10px] uppercase text-slate-400 flex items-center gap-2 italic"><ImageIcon className="h-3 w-3" /> Thông tin khác</h3>
                      <textarea rows={4} className="w-full p-3 bg-slate-50 border rounded-xl text-sm outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Mô tả sản phẩm..." />
                      <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t flex justify-end gap-3">
              <button 
                onClick={() => { setShowProductModal(false); setIsQuickAddMode(false); }}
                className="px-6 py-2 border rounded-lg font-black text-xs uppercase hover:bg-slate-50 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleSaveProduct(false)}
                className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black text-xs uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
              >
                Lưu & Thêm vào phiếu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleExcelImport} />
    </div>
  );
};

// Optimized Sub-components
const ProductRow = React.memo(({ product, isSelected, onSelect, onEdit }: { 
  product: POSProduct, 
  isSelected: boolean, 
  onSelect: (id: string) => void, 
  onEdit: (p: POSProduct) => void 
}) => (
  <tr className="hover:bg-slate-50/50 group transition-all">
    <td className="p-6 text-center border-r border-slate-50">
      <input 
        type="checkbox" 
        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" 
        checked={isSelected} 
        onChange={() => onSelect(product.id)} 
      />
    </td>
    <td className="p-6">
      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-mono font-black text-[10px] border border-indigo-100 tracking-tight">{product.sku}</span>
    </td>
    <td className="p-6 font-bold text-slate-900 text-sm min-w-[200px]">{product.name}</td>
    <td className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
      <span className="px-3 py-1 bg-slate-100 rounded-full">{product.categoryId || 'Khác'}</span>
    </td>
    <td className="p-6 text-right font-black text-slate-950 text-sm tabular-nums">{product.salePrice.toLocaleString()}đ</td>
    <td className="p-6 text-right font-bold text-slate-400 text-xs tabular-nums">{product.importPrice.toLocaleString()}đ</td>
    <td className="p-6">
      <span className="text-xs font-bold text-slate-500 underline decoration-slate-200 underline-offset-4 decoration-2">{product.brand || '---'}</span>
    </td>
    <td className="p-6 text-right">
      <span className={`font-black text-base tabular-nums ${product.stock <= (product.minStock || 5) ? 'text-rose-600' : 'text-slate-800'}`}>{product.stock}</span>
    </td>
    <td className="p-6 text-center">
      <div className="flex justify-center gap-2">
        <button 
          onClick={() => onEdit(product)} 
          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
        >
          <Edit2 className="h-4.5 w-4.5" />
        </button>
      </div>
    </td>
  </tr>
));

export default GoodsInventory;
