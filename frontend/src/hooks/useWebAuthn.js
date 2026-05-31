import { useCallback } from 'react';
import api from '../lib/api';

// --- base64url <-> ArrayBuffer helpers (WebAuthn wire format) ---------------
function b64urlToBuffer(value) {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function prepareCreation(publicKey) {
  return {
    ...publicKey,
    challenge: b64urlToBuffer(publicKey.challenge),
    user: { ...publicKey.user, id: b64urlToBuffer(publicKey.user.id) },
    excludeCredentials: (publicKey.excludeCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
}

function prepareRequest(publicKey) {
  return {
    ...publicKey,
    challenge: b64urlToBuffer(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
}

function attestationToJSON(credential) {
  return {
    id: credential.id,
    rawId: bufferToB64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToB64url(credential.response.clientDataJSON),
      attestationObject: bufferToB64url(credential.response.attestationObject),
      transports: credential.response.getTransports ? credential.response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
}

function assertionToJSON(credential) {
  return {
    id: credential.id,
    rawId: bufferToB64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToB64url(credential.response.clientDataJSON),
      authenticatorData: bufferToB64url(credential.response.authenticatorData),
      signature: bufferToB64url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bufferToB64url(credential.response.userHandle)
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
}

export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    !!navigator.credentials
  );
}

export function useWebAuthn() {
  // Register a new biometric/passkey for the currently authenticated user.
  const registerBiometric = useCallback(async (deviceName = 'This device') => {
    const { data } = await api.get('/auth/webauthn/challenge');
    if (data.mode !== 'register') {
      throw new Error('Could not start registration. Please log in again.');
    }
    const publicKey = prepareCreation(data.publicKey);
    const credential = await navigator.credentials.create({ publicKey });
    const res = await api.post('/auth/webauthn/register', {
      credential: attestationToJSON(credential),
      device_name: deviceName,
    });
    return res.data;
  }, []);

  // Passwordless login with a registered biometric/passkey.
  const loginWithBiometric = useCallback(async () => {
    const { data } = await api.get('/auth/webauthn/challenge');
    const publicKey = prepareRequest(data.publicKey);
    const credential = await navigator.credentials.get({ publicKey });
    const res = await api.post('/auth/webauthn/authenticate', {
      credential: assertionToJSON(credential),
    });
    return res.data;
  }, []);

  return { registerBiometric, loginWithBiometric, isSupported: isWebAuthnSupported() };
}
