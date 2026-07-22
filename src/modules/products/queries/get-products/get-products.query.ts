// ─── QUERY ───────────────────────────────────────────────────────────────────
import { ProductQueryDto } from '../../dto/product.dto';

// Query: plain object chứa tham số tìm kiếm
// QueryBus.execute(new GetProductsQuery(...)) → GetProductsHandler.execute()
export class GetProductsQuery {
  constructor(public readonly filters: ProductQueryDto) {}
}
