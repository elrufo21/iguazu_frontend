import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function AttendancePage() {
  return <CrudPage config={modules.attendance} />;
}
