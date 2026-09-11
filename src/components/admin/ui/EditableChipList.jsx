import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

/**
 * Lista de itens removíveis (chip + botão de apagar) seguida de uma linha
 * pra adicionar um novo — o mesmo padrão que estava duplicado em
 * "Contatos oficiais" e "Perguntas sugeridas" no SettingsForm. A linha de
 * adicionar em si fica livre (children), porque cada uso precisa de campos
 * diferentes (um texto só, ou par label+valor).
 */
export default function EditableChipList({
  items,
  renderChip,
  onRemove,
  removeLabel,
  maxItems,
  children,
}) {
  const atLimit = maxItems != null && items.length >= maxItems;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="glass-subtle flex-1 rounded-xl px-4 py-2 text-sm text-zinc-300">
            {renderChip(item, i)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={removeLabel ? removeLabel(item, i) : "Remover"}
            className="text-zinc-600 transition hover:text-red-400"
          >
            <DeleteOutlineIcon fontSize="small" />
          </button>
        </div>
      ))}

      {!atLimit && children}
    </div>
  );
}
