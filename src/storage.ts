type IStorage = {
  count: number;
  page: number;
  total: 0;
};

const defaultStorage: IStorage = {
  count: 0,
  page: 0,
  total: 0,
};

export const storage = {
  get: (): Promise<IStorage> =>
    chrome.storage.sync.get(defaultStorage) as Promise<IStorage>,
  set: (value: IStorage): Promise<void> => chrome.storage.sync.set(value),
};
