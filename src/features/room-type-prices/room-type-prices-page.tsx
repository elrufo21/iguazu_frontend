import { modules } from '../module-config';
import { CrudPage } from '../shared/crud-page';

export function RoomTypePricesPage() {
  return <CrudPage config={modules.roomTypePrices} />;
}
