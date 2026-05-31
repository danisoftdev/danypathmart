<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use RuntimeException;
use Symfony\Component\Serializer\SerializerInterface;
use Webauthn\AttestationStatement\AttestationStatementSupportManager;
use Webauthn\AttestationStatement\NoneAttestationStatementSupport;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\AuthenticatorAttestationResponseValidator;
use Webauthn\AuthenticatorSelectionCriteria;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;
use Webauthn\CredentialRecord;
use Webauthn\Denormalizer\WebauthnSerializerFactory;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialParameters;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialRpEntity;
use Webauthn\PublicKeyCredentialUserEntity;

/**
 * Thin wrapper around web-auth/webauthn-lib (v5) for the registration and
 * authentication ceremonies. COSE algorithms supported: ES256 (-7), RS256 (-257).
 */
final class WebAuthnService
{
    private const COSE_ES256 = -7;
    private const COSE_RS256 = -257;
    private const TIMEOUT_MS = 60000;

    private SerializerInterface $serializer;
    private CeremonyStepManagerFactory $ceremonyFactory;

    public function __construct()
    {
        Env::load();
        $attestationManager = new AttestationStatementSupportManager([
            new NoneAttestationStatementSupport(),
        ]);
        $this->serializer = (new WebauthnSerializerFactory($attestationManager))->create();

        $this->ceremonyFactory = new CeremonyStepManagerFactory();
        $this->ceremonyFactory->setAllowedOrigins([$this->origin()]);
    }

    public function rpId(): string
    {
        return (string) Env::get('WEBAUTHN_RP_ID', 'localhost');
    }

    public function rpName(): string
    {
        return (string) Env::get('WEBAUTHN_RP_NAME', 'DanyPathMart');
    }

    public function origin(): string
    {
        return (string) Env::get('WEBAUTHN_ORIGIN', 'http://localhost:5173');
    }

    public static function base64url(string $binary): string
    {
        return rtrim(strtr(base64_encode($binary), '+/', '-_'), '=');
    }

    /**
     * @param array<string,mixed> $user
     */
    public function createOptions(array $user): PublicKeyCredentialCreationOptions
    {
        $rp = PublicKeyCredentialRpEntity::create($this->rpName(), $this->rpId());
        $userEntity = PublicKeyCredentialUserEntity::create(
            (string) $user['email'],
            (string) $user['id'],
            (string) ($user['name'] ?? $user['username'] ?? $user['email'])
        );

        return PublicKeyCredentialCreationOptions::create(
            $rp,
            $userEntity,
            random_bytes(32),
            [
                PublicKeyCredentialParameters::createPk(self::COSE_ES256),
                PublicKeyCredentialParameters::createPk(self::COSE_RS256),
            ],
            AuthenticatorSelectionCriteria::create(
                null,
                AuthenticatorSelectionCriteria::USER_VERIFICATION_REQUIREMENT_PREFERRED,
                AuthenticatorSelectionCriteria::RESIDENT_KEY_REQUIREMENT_PREFERRED
            ),
            PublicKeyCredentialCreationOptions::ATTESTATION_CONVEYANCE_PREFERENCE_NONE,
            [],
            self::TIMEOUT_MS
        );
    }

    public function requestOptions(): PublicKeyCredentialRequestOptions
    {
        return PublicKeyCredentialRequestOptions::create(
            random_bytes(32),
            $this->rpId(),
            [],
            PublicKeyCredentialRequestOptions::USER_VERIFICATION_REQUIREMENT_PREFERRED,
            self::TIMEOUT_MS
        );
    }

    public function toJson(object $options): string
    {
        return $this->serializer->serialize($options, 'json');
    }

    public function creationOptionsFromJson(string $json): PublicKeyCredentialCreationOptions
    {
        /** @var PublicKeyCredentialCreationOptions */
        return $this->serializer->deserialize($json, PublicKeyCredentialCreationOptions::class, 'json');
    }

    public function requestOptionsFromJson(string $json): PublicKeyCredentialRequestOptions
    {
        /** @var PublicKeyCredentialRequestOptions */
        return $this->serializer->deserialize($json, PublicKeyCredentialRequestOptions::class, 'json');
    }

    public function parseCredential(string $json): PublicKeyCredential
    {
        /** @var PublicKeyCredential */
        return $this->serializer->deserialize($json, PublicKeyCredential::class, 'json');
    }

    public function verifyRegistration(
        PublicKeyCredentialCreationOptions $options,
        PublicKeyCredential $credential,
        string $host
    ): CredentialRecord {
        if (!$credential->response instanceof AuthenticatorAttestationResponse) {
            throw new RuntimeException('Expected an attestation response');
        }
        $validator = AuthenticatorAttestationResponseValidator::create(
            $this->ceremonyFactory->creationCeremony()
        );
        return $validator->check($credential->response, $options, $host);
    }

    public function verifyAssertion(
        CredentialRecord $record,
        PublicKeyCredentialRequestOptions $options,
        PublicKeyCredential $credential,
        string $host,
        ?string $userHandle
    ): CredentialRecord {
        if (!$credential->response instanceof AuthenticatorAssertionResponse) {
            throw new RuntimeException('Expected an assertion response');
        }
        $validator = AuthenticatorAssertionResponseValidator::create(
            $this->ceremonyFactory->requestCeremony()
        );
        return $validator->check($record, $credential->response, $options, $host, $userHandle);
    }

    public function recordToJson(CredentialRecord $record): string
    {
        return $this->serializer->serialize($record, 'json');
    }

    public function recordFromJson(string $json): CredentialRecord
    {
        /** @var CredentialRecord */
        return $this->serializer->deserialize($json, CredentialRecord::class, 'json');
    }
}
