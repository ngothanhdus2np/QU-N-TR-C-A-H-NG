import React, { useState } from 'react';
import { Layers, ShoppingCart, Store } from 'lucide-react';
import ShippingOrders from '../orders/ShippingOrders';
import WebsiteOrdersPage from '../website/WebsiteOrdersPage';
import AllOrdersPage from './AllOrdersPage';

type Tab = 'all' | 'shopee' | 'website';

interface Props {
  navigationSlot?: React.ReactNode;
}

function btnClass(active: boolean) {
  return `flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
  }`;
}

export default function OnlineOrdersPage({ navigationSlot }: Props) {
  const [tab, setTab] = useState<Tab>('all');

  const tabSwitcher = (
    <div className="mt-3 flex flex-col gap-1 rounded-lg bg-slate-100 p-1">
      <button onClick={() => setTab('all')} className={btnClass(tab === 'all')}>
        <Layers size={12} />
        Tất cả
      </button>
      <div className="flex gap-1">
        <button onClick={() => setTab('shopee')} className={btnClass(tab === 'shopee')}>
          <ShoppingCart size={12} />
          Shopee
        </button>
        <button onClick={() => setTab('website')} className={btnClass(tab === 'website')}>
          <Store size={12} />
          Website
        </button>
      </div>
    </div>
  );

  const navWithTabs = (
    <>
      {navigationSlot}
      {tabSwitcher}
    </>
  );

  if (tab === 'shopee') {
    return <ShippingOrders navigationSlot={navWithTabs} />;
  }

  if (tab === 'website') {
    return (
      <React.Suspense fallback={null}>
        <WebsiteOrdersPage navigationSlot={navWithTabs} />
      </React.Suspense>
    );
  }

  // tab === 'all'
  return <AllOrdersPage navigationSlot={navWithTabs} />;
}
