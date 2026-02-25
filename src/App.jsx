import { useMemo, useState } from "react";
import "./App.css";

function App() {
  const [cipher, setCipher] = useState("vigenere");
  const [mode, setMode] = useState("encrypt");
  const [key, setKey] = useState("");
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [outputText, setOutputText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sanitizedText = useMemo(
    () => inputText.toUpperCase().replace(/[^A-Z]/g, ""),
    [inputText],
  );

  const clearResult = () => {
    setOutputText("");
    setErrorMessage("");
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl("");
  };

  const modInverse = (a, m) => {
    const normalized = ((a % m) + m) % m;
    for (let i = 1; i < m; i += 1) {
      if ((normalized * i) % m === 1) {
        return i;
      }
    }
    return null;
  };

  const vigenere = (text, rawKey, selectedMode) => {
    const normalizedKey = rawKey.toUpperCase().replace(/[^A-Z]/g, "");
    if (!normalizedKey) {
      throw new Error("Key Vigenere harus berisi huruf A-Z.");
    }

    let keyIndex = 0;
    return text
      .split("")
      .map((char) => {
        const shift =
          normalizedKey.charCodeAt(keyIndex % normalizedKey.length) - 65;
        keyIndex += 1;
        const base = char.charCodeAt(0) - 65;
        const next =
          selectedMode === "encrypt"
            ? (base + shift) % 26
            : (base - shift + 26) % 26;
        return String.fromCharCode(next + 65);
      })
      .join("");
  };

  const affine = (text, rawKey, selectedMode) => {
    const [a, b] = rawKey.split(",").map((part) => Number(part.trim()));
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new Error("Key Affine harus format a,b. Contoh: 5,3");
    }

    const inverseA = modInverse(a, 26);
    if (inverseA === null) {
      throw new Error("Nilai a pada Affine tidak punya invers modulo 26.");
    }

    return text
      .split("")
      .map((char) => {
        const x = char.charCodeAt(0) - 65;
        const y =
          selectedMode === "encrypt"
            ? (a * x + b) % 26
            : (inverseA * (x - b + 26)) % 26;
        return String.fromCharCode(((y + 26) % 26) + 65);
      })
      .join("");
  };

  const playfair = (text, rawKey, selectedMode) => {
    const normalizedKey = rawKey
      .toUpperCase()
      .replace(/J/g, "I")
      .replace(/[^A-Z]/g, "");

    if (!normalizedKey) {
      throw new Error("Key Playfair harus berisi huruf A-Z.");
    }

    const matrix = [];
    const used = new Set();
    [...normalizedKey, ..."ABCDEFGHIKLMNOPQRSTUVWXYZ"].forEach((char) => {
      if (!used.has(char)) {
        used.add(char);
        matrix.push(char);
      }
    });

    const grid = [];
    for (let i = 0; i < 5; i += 1) {
      grid.push(matrix.slice(i * 5, (i + 1) * 5));
    }

    const normalizedText = text.replace(/J/g, "I");
    const pairs = [];
    for (let i = 0; i < normalizedText.length; i += 2) {
      const a = normalizedText[i];
      const b = i + 1 < normalizedText.length ? normalizedText[i + 1] : "X";
      if (a === b) {
        pairs.push([a, "X"]);
        i -= 1;
      } else {
        pairs.push([a, b]);
      }
    }

    const findPos = (char) => {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (grid[row][col] === char) {
            return [row, col];
          }
        }
      }
      return [0, 0];
    };

    return pairs
      .map(([a, b]) => {
        const [row1, col1] = findPos(a);
        const [row2, col2] = findPos(b);

        if (row1 === row2) {
          const shift = selectedMode === "encrypt" ? 1 : 4;
          return (
            grid[row1][(col1 + shift) % 5] + grid[row2][(col2 + shift) % 5]
          );
        }

        if (col1 === col2) {
          const shift = selectedMode === "encrypt" ? 1 : 4;
          return (
            grid[(row1 + shift) % 5][col1] + grid[(row2 + shift) % 5][col2]
          );
        }

        return grid[row1][col2] + grid[row2][col1];
      })
      .join("");
  };

  const hill = (text, rawKey, selectedMode) => {
    const matrix = rawKey.split(",").map((part) => Number(part.trim()));
    if (matrix.length !== 4 || matrix.some((value) => Number.isNaN(value))) {
      throw new Error("Key Hill harus 4 angka: a,b,c,d. Contoh: 6,24,1,13");
    }

    const determinant = (matrix[0] * matrix[3] - matrix[1] * matrix[2]) % 26;
    const inverseDet = modInverse(determinant, 26);
    if (inverseDet === null) {
      throw new Error("Matriks Hill tidak invertible modulo 26.");
    }

    const adjugate = [matrix[3], -matrix[1], -matrix[2], matrix[0]];
    const inverseMatrix = adjugate.map(
      (value) => (((value * inverseDet) % 26) + 26) % 26,
    );

    const workingText = text.length % 2 === 0 ? text : `${text}X`;
    const activeMatrix = selectedMode === "encrypt" ? matrix : inverseMatrix;

    let result = "";
    for (let i = 0; i < workingText.length; i += 2) {
      const vector = [
        workingText.charCodeAt(i) - 65,
        workingText.charCodeAt(i + 1) - 65,
      ];
      const out = [
        (activeMatrix[0] * vector[0] + activeMatrix[1] * vector[1]) % 26,
        (activeMatrix[2] * vector[0] + activeMatrix[3] * vector[1]) % 26,
      ];
      result += String.fromCharCode(((out[0] + 26) % 26) + 65);
      result += String.fromCharCode(((out[1] + 26) % 26) + 65);
    }

    return result;
  };

  const enigma = (text, rawKey) => {
    const rotors = [
      "EKMFLGDQVZNTOWYHXUSPAIBRCJ".split(""),
      "AJDKSIRUXBLHWTMCQGZNPYFVOE".split(""),
      "BDFHJLCPRTXVZNYEIWGAKMUSQO".split(""),
    ];
    const reflector = "YRUHQSLDPXNGOKMIEBFZCWVJAT".split("");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    const positions = rawKey
      .split(",")
      .map((part) => Number(part.trim()))
      .map((value) => ((value % 26) + 26) % 26);

    if (
      positions.length !== 3 ||
      positions.some((value) => Number.isNaN(value))
    ) {
      throw new Error("Key Enigma harus 3 angka: r1,r2,r3. Contoh: 1,2,3");
    }

    let output = "";
    for (const char of text) {
      let index = alphabet.indexOf(char);
      if (index === -1) {
        continue;
      }

      positions[0] = (positions[0] + 1) % 26;
      if (positions[0] === 0) {
        positions[1] = (positions[1] + 1) % 26;
      }
      if (positions[1] === 0) {
        positions[2] = (positions[2] + 1) % 26;
      }

      for (let rotorIndex = 0; rotorIndex < 3; rotorIndex += 1) {
        index = (index + positions[rotorIndex]) % 26;
        index = rotors[rotorIndex].indexOf(alphabet[index]);
        index = (index - positions[rotorIndex] + 26) % 26;
      }

      index = reflector.indexOf(alphabet[index]);

      for (let rotorIndex = 2; rotorIndex >= 0; rotorIndex -= 1) {
        index = (index + positions[rotorIndex]) % 26;
        index = alphabet.indexOf(rotors[rotorIndex][index]);
        index = (index - positions[rotorIndex] + 26) % 26;
      }

      output += alphabet[index];
    }

    return output;
  };

  const processFileVigenere = async (file) => {
    const normalizedKey = key.toUpperCase().replace(/[^A-Z]/g, "");
    if (!normalizedKey) {
      throw new Error("Key Vigenere file harus huruf A-Z.");
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const keyBytes = normalizedKey
      .split("")
      .map((char) => char.charCodeAt(0) - 65);

    const processed = bytes.map((byte, index) => {
      const shift = keyBytes[index % keyBytes.length];
      return mode === "encrypt"
        ? (byte + shift) % 256
        : (byte - shift + 256) % 256;
    });

    const blob = new Blob([new Uint8Array(processed)]);
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
    setOutputText("File berhasil diproses. Klik link download di bawah.");
  };

  const processInput = async () => {
    clearResult();

    try {
      if (selectedFile && cipher === "vigenere") {
        await processFileVigenere(selectedFile);
        return;
      }

      if (!sanitizedText) {
        throw new Error("Masukkan teks A-Z untuk diproses.");
      }

      let result = "";
      if (cipher === "vigenere") {
        result = vigenere(sanitizedText, key, mode);
      } else if (cipher === "affine") {
        result = affine(sanitizedText, key, mode);
      } else if (cipher === "playfair") {
        result = playfair(sanitizedText, key, mode);
      } else if (cipher === "hill") {
        result = hill(sanitizedText, key, mode);
      } else if (cipher === "enigma") {
        result = enigma(sanitizedText, key);
      }

      setOutputText(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan.",
      );
    }
  };

  return (
    <main className="container">
      <h1>Kalkulator Enkripsi-Dekripsi</h1>

      <label htmlFor="cipher">Pilih Cipher:</label>
      <select
        id="cipher"
        value={cipher}
        onChange={(event) => setCipher(event.target.value)}
      >
        <option value="vigenere">Vigenere Cipher</option>
        <option value="affine">Affine Cipher</option>
        <option value="playfair">Playfair Cipher</option>
        <option value="hill">Hill Cipher</option>
        <option value="enigma">Enigma Cipher</option>
      </select>

      <label htmlFor="mode">Mode:</label>
      <select
        id="mode"
        value={mode}
        onChange={(event) => setMode(event.target.value)}
      >
        <option value="encrypt">Enkripsi</option>
        <option value="decrypt">Dekripsi</option>
      </select>

      <label htmlFor="key">Key (sesuaikan per cipher):</label>
      <input
        id="key"
        type="text"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        placeholder="Vigenere: KEY | Affine: 5,3 | Hill: 6,24,1,13 | Enigma: 1,2,3"
      />

      <label htmlFor="inputText">Input (Plaintext/Ciphertext):</label>
      <textarea
        id="inputText"
        rows={5}
        value={inputText}
        onChange={(event) => setInputText(event.target.value)}
        placeholder="Masukkan teks di sini"
      />

      <label htmlFor="fileInput">
        Atau upload file (khusus Vigenere byte-level):
      </label>
      <input
        id="fileInput"
        type="file"
        onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
      />

      <button type="button" onClick={processInput}>
        Proses
      </button>

      <section id="output" aria-live="polite">
        {errorMessage && <p className="error">{errorMessage}</p>}
        {!errorMessage && outputText && <p>Hasil: {outputText}</p>}
        {downloadUrl && (
          <p>
            <a href={downloadUrl} download="processed_file">
              Download file hasil
            </a>
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
