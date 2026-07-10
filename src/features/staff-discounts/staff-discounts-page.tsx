import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function StaffDiscountsPage() {
  return <CrudPage config={modules.staffDiscounts} />;
}
