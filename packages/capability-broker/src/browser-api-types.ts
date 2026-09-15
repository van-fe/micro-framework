export interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: unknown) => Promise<readonly FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
}

export interface NotificationConstructor {
  readonly permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  new(title: string, options?: NotificationOptions): Notification;
}

export type PaymentRequestConstructor = new(
  methodData: readonly PaymentMethodData[],
  details: PaymentDetailsInit,
  options?: PaymentOptions,
) => PaymentRequest;
