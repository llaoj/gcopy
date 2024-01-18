import Title from "./title";

export default function Notice() {
  return (
    <>
      <Title title="Notice"></Title>
      <div className="prose">
        <ol>
          <li>
            Click <strong>Allow</strong> when the browser asks you{" "}
            <strong>Share clipboard?</strong>
          </li>
          <li>
            We recommend using Google Chrome{" "}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              className="h-5 w-5 inline not-prose"
              viewBox="0 0 16 16"
            >
              <path d="M16 8a8.001 8.001 0 0 1-7.022 7.94l1.902-7.098a2.995 2.995 0 0 0 .05-1.492A2.977 2.977 0 0 0 10.237 6h5.511A8 8 0 0 1 16 8ZM0 8a8 8 0 0 0 7.927 8l1.426-5.321a2.978 2.978 0 0 1-.723.255 2.979 2.979 0 0 1-1.743-.147 2.986 2.986 0 0 1-1.043-.7L.633 4.876A7.975 7.975 0 0 0 0 8Zm5.004-.167L1.108 3.936A8.003 8.003 0 0 1 15.418 5H8.066a2.979 2.979 0 0 0-1.252.243 2.987 2.987 0 0 0-1.81 2.59ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
            </svg>{" "}
            86+.
          </li>
          <li>
            GCopy protects your privacy data by temporarily storing your latest
            clipboard data in memory only. GCopy does not persist your clipboard
            data.
          </li>
        </ol>
      </div>
    </>
  );
}
