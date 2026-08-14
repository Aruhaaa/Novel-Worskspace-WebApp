import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export default forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.name });
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
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[200px] z-50">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`text-left px-4 py-2 text-sm transition-colors ${
              index === selectedIndex ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item.name}
          </button>
        ))
      ) : (
        <div className="px-4 py-2 text-sm text-slate-500">No result</div>
      )}
    </div>
  );
});
