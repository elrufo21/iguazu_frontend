import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function ProductsPage() {
  return <CrudPage config={modules.products} />;
}
