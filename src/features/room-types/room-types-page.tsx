import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function RoomTypesPage() {
  return <CrudPage config={modules.roomTypes} />;
}
