import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function StaffAdvancesPage() {
  return <CrudPage config={modules.staffAdvances} />;
}
