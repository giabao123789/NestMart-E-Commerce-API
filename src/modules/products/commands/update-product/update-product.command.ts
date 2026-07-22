// ─── COMMAND ─────────────────────────────────────────────────────────────────
export class UpdateProductCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly price?: number,
    public readonly categoryId?: string,
    public readonly description?: string,
    public readonly stock?: number,
    public readonly imageUrl?: string,
    public readonly isActive?: boolean,
  ) {}
}
