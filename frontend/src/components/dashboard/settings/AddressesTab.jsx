import { useState } from 'react';
import {
  useAddresses,
  useAddAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from '../../../hooks/checkout';
import Modal from '../Modal';
import AddressForm from './AddressForm';

export default function AddressesTab() {
  const { data, isLoading } = useAddresses();
  const addAddress = useAddAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit', address }
  const [confirmId, setConfirmId] = useState(null);

  const addresses = data?.data ?? [];

  const handleSubmit = async (form) => {
    if (modal?.mode === 'edit') {
      await updateAddress.mutateAsync({ id: modal.address.id, ...form });
    } else {
      await addAddress.mutateAsync(form);
    }
    setModal(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Saved addresses</h3>
        <button type="button" onClick={() => setModal({ mode: 'add' })} className="btn-primary py-2 text-sm">
          + Add new
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-black/50 dark:text-white/50">Loading addresses...</p>
      ) : addresses.length === 0 ? (
        <div className="card-panel text-center text-sm text-black/60 dark:text-white/60">
          No saved addresses yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div key={addr.id} className="card-panel">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{addr.recipient_name}</p>
                {!!addr.is_default && (
                  <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold text-brand-green">
                    DEFAULT
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">{addr.phone}</p>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {addr.street}, {addr.city}, {addr.region}
                {addr.landmark ? ` (${addr.landmark})` : ''}
              </p>

              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefault.mutate(addr.id)}
                    className="text-brand-green hover:underline"
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModal({ mode: 'edit', address: addr })}
                  className="text-black/60 hover:underline dark:text-white/60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(addr.id)}
                  className="text-brand-red hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit address' : 'Add address'}
      >
        {modal && (
          <AddressForm
            initial={modal.mode === 'edit' ? modal.address : null}
            onSubmit={handleSubmit}
            submitting={addAddress.isPending || updateAddress.isPending}
          />
        )}
      </Modal>

      <Modal open={!!confirmId} onClose={() => setConfirmId(null)} title="Delete address" maxWidth="max-w-sm">
        <p className="text-sm text-black/60 dark:text-white/60">
          Are you sure you want to delete this address? This cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={async () => {
              await deleteAddress.mutateAsync(confirmId);
              setConfirmId(null);
            }}
            disabled={deleteAddress.isPending}
            className="flex-1 rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {deleteAddress.isPending ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmId(null)}
            className="flex-1 rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/15"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
