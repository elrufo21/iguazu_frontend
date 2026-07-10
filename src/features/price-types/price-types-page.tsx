import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function PriceTypesPage() {
  return <CrudPage config={modules.priceTypes} />;
}
