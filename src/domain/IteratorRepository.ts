export type Meta = object

export interface IteratorRepository {
  prefix<T extends object, M extends Meta> (key: string): ActualIteratorRepository<T, M>
}

export interface ActualIteratorRepository<T extends object, M extends Meta> {
  write (key: string, meta: M, source: AsyncIterable<T>): Promise<void>
  meta (key: string): Promise<M|null>
  read (key: string): AsyncIterable<T>
}
