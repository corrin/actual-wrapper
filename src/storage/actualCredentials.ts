import * as Keychain from 'react-native-keychain';

export type ActualCredentials = {
  encryptionPassword: string | null;
  serverPassword: string;
  token: string;
};

export type ActualCredentialPresence = {
  hasEncryptionPassword: boolean;
  hasServerPassword: boolean;
  hasToken: boolean;
};

const ENCRYPTION_PASSWORD_KEY = 'actual-wrapper.encryption-password';
const SERVER_PASSWORD_KEY = 'actual-wrapper.server-password';
const TOKEN_KEY = 'actual-wrapper.actual-token';

async function getSecureItem(key: string): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: key });
  return credentials ? credentials.password : null;
}

async function setSecureItem(key: string, value: string): Promise<void> {
  await Keychain.setGenericPassword('actual-wrapper', value, {
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    service: key,
  });
}

async function deleteSecureItem(key: string): Promise<void> {
  await Keychain.resetGenericPassword({ service: key });
}

export async function loadActualCredentials(): Promise<ActualCredentials | null> {
  const [serverPassword, token, encryptionPassword] = await Promise.all([
    getSecureItem(SERVER_PASSWORD_KEY),
    getSecureItem(TOKEN_KEY),
    getSecureItem(ENCRYPTION_PASSWORD_KEY),
  ]);

  if (!serverPassword || !token) {
    return null;
  }

  return {
    encryptionPassword,
    serverPassword,
    token,
  };
}

export async function loadActualCredentialPresence(): Promise<ActualCredentialPresence> {
  const [serverPassword, token, encryptionPassword] = await Promise.all([
    getSecureItem(SERVER_PASSWORD_KEY),
    getSecureItem(TOKEN_KEY),
    getSecureItem(ENCRYPTION_PASSWORD_KEY),
  ]);

  return {
    hasEncryptionPassword: Boolean(encryptionPassword),
    hasServerPassword: Boolean(serverPassword),
    hasToken: Boolean(token),
  };
}

export async function saveActualCredentials({
  encryptionPassword,
  serverPassword,
  token,
}: ActualCredentials): Promise<void> {
  await Promise.all([
    setSecureItem(SERVER_PASSWORD_KEY, serverPassword),
    setSecureItem(TOKEN_KEY, token),
    encryptionPassword
      ? setSecureItem(ENCRYPTION_PASSWORD_KEY, encryptionPassword)
      : deleteSecureItem(ENCRYPTION_PASSWORD_KEY),
  ]);
}

export async function clearActualCredentials(): Promise<void> {
  await Promise.all([
    deleteSecureItem(ENCRYPTION_PASSWORD_KEY),
    deleteSecureItem(SERVER_PASSWORD_KEY),
    deleteSecureItem(TOKEN_KEY),
  ]);
}
