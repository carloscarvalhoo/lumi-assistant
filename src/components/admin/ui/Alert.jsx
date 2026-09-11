import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const VARIANTS = {
  error: {
    cls: "border-red-500/25 text-red-200",
    Icon: ErrorOutlineIcon,
  },
  success: {
    cls: "border-emerald-500/25 text-emerald-200",
    Icon: CheckCircleOutlineIcon,
  },
};

/**
 * Banner de mensagem inline (erro/sucesso) usado abaixo de formulários.
 * Substitui o mesmo `<div className="glass rounded-xl border-... px-4 py-3
 * text-sm ...">` que estava duplicado em vários cards de upload/formulário.
 */
export default function Alert({ variant = "error", icon = true, className = "", children }) {
  if (!children) return null;
  const { cls, Icon } = VARIANTS[variant] || VARIANTS.error;

  return (
    <div
      className={`glass flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${cls} ${className}`}
    >
      {icon && <Icon fontSize="small" className="mt-0.5 shrink-0" />}
      {children}
    </div>
  );
}
