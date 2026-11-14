import { tmap, tr } from './lang';

export const PRODUCT_TYPE_LABEL: Record<string, string> = tmap({
  physical: 'Physical',
  bulk: 'Bulk',
  operator: 'Operator card',
  supplier: 'Supplier',
  mfs: 'MFS',
});

export const SECTOR_LABEL: Record<string, string> = tmap({
  mfs: 'MFS',
  operator: 'Operator',
  physical: 'Mobile & physical',
  bulk: 'Bulk items',
  supplier: 'Supplier',
  others: 'Others',
});

export const MFS_TX_LABEL: Record<string, string> = tmap({
  balance_in: 'Add e-balance (SR)',
  send_money: 'Send money',
  e_balance_add: 'E-balance for customer',
  cash_out: 'Cash out',
});

export const CAPITAL_SOURCE_LABEL: Record<string, string> = tmap({
  personal: 'Personal money',
  friend_family: 'Friend / family',
  loan: 'Loan',
});

export const EMPLOYEE_PERM_LABEL: Record<string, string> = tmap({
  'sale.create': 'Sell and scan barcodes',
  'sale.view_all': 'See all employees’ sales',
  'sale.cancel': 'Cancel sales',
  'sale.override_price': 'Change price while selling',
  'product.view': 'See cost price and full product details',
  'product.create': 'Add products',
  'product.update': 'Edit products',
  'product.delete': 'Delete products',
  'stock.restock': 'Add stock',
  'category.manage': 'Manage categories',
  'barcode.print': 'Print barcodes',
  'mfs.use': 'Use MFS',
  'due.collect': 'Collect dues',
  'warranty.manage': 'See warranty and register claims',
});

export const STAFF_PERM_LABEL: Record<string, string> = tmap({
  'shop.view': 'View shops and usage',
  'shop.manage': 'Block, restrict, delete shops',
  'chat.reply': 'Reply to live chat',
  'alert.send': 'Send alerts',
  'billing.view': 'View payments',
  'plan.manage': 'Manage plans',
});

export const MFS_PROVIDERS = ['bkash', 'nagad', 'rocket', 'upay'] as const;
export const SECTORS = ['mfs', 'operator', 'physical', 'bulk', 'supplier', 'others'] as const;

/** Capital sector of a category: the one chosen for it, else its parent's, else the one that fits its product type. */
export const sectorOf = (c?: { capitalSector?: string | null; productType?: string } | null, parent?: { capitalSector?: string | null; productType?: string } | null): string =>
  c?.capitalSector ?? parent?.capitalSector ?? ((SECTORS as readonly string[]).includes(c?.productType ?? '') ? (c!.productType as string) : 'others');
export const PROVIDER_COLOR: Record<string, string> = {
  bkash: '#E2136E',
  nagad: '#F26B21',
  rocket: '#8C3494',
  upay: '#0B8F4D',
  robi: '#E8112D',
  airtel: '#E40000',
  banglalink: '#F26522',
  grameenphone: '#0099DB',
  teletalk: '#00A651',
};

export const WARRANTY_KIND_LABEL: Record<string, string> = tmap({ warranty: 'Warranty', guarantee: 'Guarantee' });
export const WARRANTY_UNIT_LABEL: Record<string, string> = tmap({ day: 'days', month: 'months', year: 'years' });
export const CLAIM_KIND_LABEL: Record<string, string> = tmap({ repair: 'Repair', replace: 'Replacement', refund: 'Refund / return' });
/** "1 year warranty · 1 claim" */
export const warrantyText = (w?: { enabled?: boolean; kind?: string; durationValue?: number; durationUnit?: string; maxClaims?: number }) => {
  if (!w?.enabled) return tr('No warranty');
  const n = w.durationValue ?? 1;
  const unit = tr(n === 1 ? ({ day: 'day', month: 'month', year: 'year' } as Record<string, string>)[w.durationUnit ?? 'year'] : (w.durationUnit ?? 'year') + 's');
  const claims = w.maxClaims ?? 1;
  return `${n} ${unit} ${tr(w.kind === 'guarantee' ? 'guarantee' : 'warranty')} · ${claims} ${tr(claims === 1 ? 'claim' : 'claims')}`;
};

/** Built-in category names (Mobile Phone, Android Phone, Button Phone, iOS Phone) follow the app language; the shop's own names are shown as typed. */
const BUILT_IN = new Set(['Mobile Phone', 'Android Phone', 'Button Phone', 'iOS Phone']);
export const catName = (name: string) => (BUILT_IN.has(name) ? tr(name) : name);
