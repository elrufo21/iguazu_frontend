import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function UsersPage() {
  return <CrudPage config={modules.users} />;
}
