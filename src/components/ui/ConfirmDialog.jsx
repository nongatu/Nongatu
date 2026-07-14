import Modal from './Modal.jsx'

export default function ConfirmDialog({
  title = 'Confirmar acción',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-outline" onClick={onCancel}>{cancelText}</button>
          <button className={`btn ${danger ? 'btn-red' : 'btn-blue'}`} onClick={onConfirm}>{confirmText}</button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{message}</p>
    </Modal>
  )
}
