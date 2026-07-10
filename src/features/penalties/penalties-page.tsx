import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function PenaltiesPage() {
  return <CrudPage config={modules.penalties} />;
}
