import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function InventoryPage() {
  return <CrudPage config={modules.inventory} />;
}
