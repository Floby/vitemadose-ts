//export type Meta = Record<string, string|number|boolean>
export type Meta = object

export interface Repository<T extends object, M extends Meta> {
  write (key: string, meta: M, source: AsyncIterable<T>): Promise<void>
  meta (key: string): Promise<M|null>
  read (key: string): AsyncIterable<T>
}
