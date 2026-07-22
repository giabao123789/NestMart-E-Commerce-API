// ─── COMMAND ─────────────────────────────────────────────────────────────────
export class CreateProductCommand {
  constructor(
    public readonly name: string,
    public readonly price: number,
    public readonly categoryId: string,
    public readonly description?: string,
    public readonly stock?: number,
    public readonly imageUrl?: string,
  ) {}
}
