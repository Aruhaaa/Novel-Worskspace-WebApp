import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export default forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      // Link by id so the mention still points at the entry if it is renamed later
      props.command({ id: item.id, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="mention-pop" role="listbox" aria-label="Mention suggestions" style={{ position: 'static' }}>
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            role="option"
            aria-selected={index === selectedIndex}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item.name}
            {item.type && <small style={{ textTransform: 'capitalize' }}>{item.type}</small>}
          </button>
        ))
      ) : (
        <p style={{ padding: '8px 10px', fontSize: 12, color: 'var(--muted)', margin: 0 }}>No result</p>
      )}
    </div>
  );
});
