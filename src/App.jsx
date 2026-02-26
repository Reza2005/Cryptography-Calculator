import { useEffect, useMemo, useState } from "react";
import "./App.css";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ENIGMA_ROTORS = {
  I: { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II: { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV: { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V: { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" },
};
const ENIGMA_REFLECTORS = {
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

const toIndex = (char) => ALPHABET.indexOf(char);
const toChar = (index) => ALPHABET[index];

const createInverseWiring = (wiring) => {
  const inverse = Array(26).fill(0);
  for (let i = 0; i < 26; i += 1) {
    inverse[toIndex(wiring[i])] = i;
  }
  return inverse;
};

function App() {
  const [cipher, setCipher] = useState("vigenere");
  const [mode, setMode] = useState("encrypt");
  const [key, setKey] = useState("");
  const [enigmaRotorOrder, setEnigmaRotorOrder] = useState("I,II,III");
  const [enigmaRingSettings, setEnigmaRingSettings] = useState("1,1,1");
  const [enigmaReflector, setEnigmaReflector] = useState("B");
  const [enigmaPlugboard, setEnigmaPlugboard] = useState("");
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [outputText, setOutputText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const sanitizedText = useMemo(
    () => inputText.toUpperCase().replace(/[^A-Z]/g, ""),
    [inputText],
  );

  const clearResult = () => {
    setOutputText("");
    setErrorMessage("");
    setInfoMessage("");
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl("");
  };

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const getKeyGuideline = (selectedCipher) => {
    if (selectedCipher === "vigenere") {
      return "Huruf A-Z. Contoh: KEY";
    }
    if (selectedCipher === "affine") {
      return "Format a,b dan a harus punya invers modulo 26. Contoh: 5,3";
    }
    if (selectedCipher === "playfair") {
      return "Huruf A-Z (J akan dianggap I). Contoh: MONARCHY";
    }
    if (selectedCipher === "hill") {
      return "Format 4 angka a,b,c,d. Contoh: 6,24,1,13";
    }
    return "Posisi rotor awal (kiri,tengah,kanan): huruf A-Z atau angka. Contoh: A,A,A / 1,1,1";
  };

  const getKeyPlaceholder = (selectedCipher) => {
    if (selectedCipher === "vigenere") {
      return "Contoh: KEY";
    }
    if (selectedCipher === "affine") {
      return "Contoh: 5,3";
    }
    if (selectedCipher === "playfair") {
      return "Contoh: MONARCHY";
    }
    if (selectedCipher === "hill") {
      return "Contoh: 6,24,1,13";
    }
    return "Contoh: A,A,A atau 1,1,1";
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

  const parseEnigmaPositions = (rawPositions) => {
    const parts = rawPositions
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length !== 3) {
      throw new Error("Posisi rotor Enigma harus 3 nilai: kiri,tengah,kanan.");
    }

    return parts.map((part) => {
      const upper = part.toUpperCase();
      if (/^[A-Z]$/.test(upper)) {
        return upper.charCodeAt(0) - 65;
      }

      const numeric = Number(part);
      if (Number.isNaN(numeric)) {
        throw new Error(
          "Posisi rotor Enigma hanya boleh huruf A-Z atau angka.",
        );
      }

      if (numeric >= 1 && numeric <= 26) {
        return numeric - 1;
      }

      return ((numeric % 26) + 26) % 26;
    });
  };

  const parseEnigmaRotorOrder = (rawOrder) => {
    const rotors = rawOrder
      .toUpperCase()
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (rotors.length !== 3) {
      throw new Error("Urutan rotor harus 3 item. Contoh: I,II,III");
    }

    const validNames = Object.keys(ENIGMA_ROTORS);
    for (const rotorName of rotors) {
      if (!validNames.includes(rotorName)) {
        throw new Error("Rotor valid: I, II, III, IV, V.");
      }
    }

    if (new Set(rotors).size !== 3) {
      throw new Error("Rotor tidak boleh duplikat.");
    }

    return rotors;
  };

  const parseEnigmaRingSettings = (rawRings) => {
    const rings = rawRings.split(",").map((part) => Number(part.trim()));

    if (rings.length !== 3 || rings.some((ring) => Number.isNaN(ring))) {
      throw new Error("Ring setting harus 3 angka. Contoh: 1,1,1");
    }

    for (const ring of rings) {
      if (ring < 1 || ring > 26) {
        throw new Error("Ring setting harus berada di rentang 1-26.");
      }
    }

    return rings.map((ring) => ring - 1);
  };

  const parsePlugboard = (rawPlugboard) => {
    const board = new Map();
    const cleaned = rawPlugboard.trim().toUpperCase();

    if (!cleaned) {
      return board;
    }

    const pairs = cleaned.split(/\s+/);
    if (pairs.length > 10) {
      throw new Error("Plugboard maksimal 10 pasangan huruf.");
    }

    const usedLetters = new Set();
    for (const pair of pairs) {
      if (!/^[A-Z]{2}$/.test(pair)) {
        throw new Error(
          "Format plugboard harus pasangan huruf. Contoh: AB CD EF",
        );
      }

      const [left, right] = pair.split("");
      if (left === right) {
        throw new Error("Plugboard tidak boleh memasangkan huruf yang sama.");
      }

      if (usedLetters.has(left) || usedLetters.has(right)) {
        throw new Error("Setiap huruf di plugboard hanya boleh muncul sekali.");
      }

      usedLetters.add(left);
      usedLetters.add(right);
      board.set(left, right);
      board.set(right, left);
    }

    return board;
  };

  const validateEnigmaConfig = (
    positions,
    rotorOrder,
    ringSettings,
    reflector,
    plugboard,
  ) => {
    try {
      parseEnigmaPositions(positions);
      parseEnigmaRotorOrder(rotorOrder);
      parseEnigmaRingSettings(ringSettings);
      parsePlugboard(plugboard);
      if (!ENIGMA_REFLECTORS[reflector]) {
        throw new Error("Reflector harus B atau C.");
      }
      return { valid: true, message: "" };
    } catch (error) {
      return {
        valid: false,
        message:
          error instanceof Error
            ? error.message
            : "Konfigurasi Enigma tidak valid.",
      };
    }
  };

  const validateKey = (selectedCipher, rawKey) => {
    const trimmed = rawKey.trim();
    if (!trimmed) {
      return { valid: false, message: "Key belum diisi." };
    }

    if (selectedCipher === "vigenere" || selectedCipher === "playfair") {
      const normalized = trimmed.toUpperCase().replace(/[^A-Z]/g, "");
      if (!normalized) {
        return { valid: false, message: "Key harus mengandung huruf A-Z." };
      }
      return { valid: true, message: "" };
    }

    if (selectedCipher === "affine") {
      const [a, b] = trimmed.split(",").map((part) => Number(part.trim()));
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return { valid: false, message: "Format key harus a,b (angka)." };
      }
      if (modInverse(a, 26) === null) {
        return {
          valid: false,
          message: "Nilai a tidak valid karena tidak punya invers modulo 26.",
        };
      }
      return { valid: true, message: "" };
    }

    if (selectedCipher === "hill") {
      const matrix = trimmed.split(",").map((part) => Number(part.trim()));
      if (matrix.length !== 4 || matrix.some((value) => Number.isNaN(value))) {
        return { valid: false, message: "Key Hill harus 4 angka: a,b,c,d." };
      }
      const determinant = (matrix[0] * matrix[3] - matrix[1] * matrix[2]) % 26;
      if (modInverse(determinant, 26) === null) {
        return {
          valid: false,
          message: "Matriks Hill tidak invertible modulo 26.",
        };
      }
      return { valid: true, message: "" };
    }

    return validateEnigmaConfig(
      trimmed,
      enigmaRotorOrder,
      enigmaRingSettings,
      enigmaReflector,
      enigmaPlugboard,
    );
  };

  const keyGuideline = useMemo(() => getKeyGuideline(cipher), [cipher]);
  const keyPlaceholder = useMemo(() => getKeyPlaceholder(cipher), [cipher]);
  const keyValidation = useMemo(
    () => validateKey(cipher, key),
    [
      cipher,
      key,
      enigmaRotorOrder,
      enigmaRingSettings,
      enigmaReflector,
      enigmaPlugboard,
    ],
  );
  const canProcess =
    keyValidation.valid &&
    (cipher === "vigenere" && selectedFile ? true : sanitizedText.length > 0);

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

  const enigma = (text, config) => {
    const positions = parseEnigmaPositions(config.positionsKey);
    const rotorOrder = parseEnigmaRotorOrder(config.rotorOrder);
    const ringSettings = parseEnigmaRingSettings(config.ringSettings);
    const reflectorWiring = ENIGMA_REFLECTORS[config.reflector];
    const plugboard = parsePlugboard(config.plugboardPairs);

    if (!reflectorWiring) {
      throw new Error("Reflector harus B atau C.");
    }

    const rotorStack = rotorOrder.map((name) => {
      const rotor = ENIGMA_ROTORS[name];
      return {
        ...rotor,
        inverse: createInverseWiring(rotor.wiring),
      };
    });

    const applyPlugboard = (char) => plugboard.get(char) ?? char;
    const atNotch = (rotorIndex, position) =>
      rotorStack[rotorIndex].notch.includes(toChar(position));

    const encodeForward = (index, rotorIndex, position, ringSetting) => {
      const rotor = rotorStack[rotorIndex];
      const shifted = (index + position - ringSetting + 26) % 26;
      const wiredIndex = toIndex(rotor.wiring[shifted]);
      return (wiredIndex - position + ringSetting + 26) % 26;
    };

    const encodeBackward = (index, rotorIndex, position, ringSetting) => {
      const rotor = rotorStack[rotorIndex];
      const shifted = (index + position - ringSetting + 26) % 26;
      const wiredIndex = rotor.inverse[shifted];
      return (wiredIndex - position + ringSetting + 26) % 26;
    };

    let [leftPos, middlePos, rightPos] = positions;
    const [leftRing, middleRing, rightRing] = ringSettings;
    let output = "";

    for (const char of text) {
      if (!/[A-Z]/.test(char)) {
        continue;
      }

      const middleAtNotch = atNotch(1, middlePos);
      const rightAtNotch = atNotch(2, rightPos);

      if (middleAtNotch) {
        middlePos = (middlePos + 1) % 26;
        leftPos = (leftPos + 1) % 26;
      }
      if (rightAtNotch) {
        middlePos = (middlePos + 1) % 26;
      }
      rightPos = (rightPos + 1) % 26;

      let signal = toIndex(applyPlugboard(char));

      signal = encodeForward(signal, 2, rightPos, rightRing);
      signal = encodeForward(signal, 1, middlePos, middleRing);
      signal = encodeForward(signal, 0, leftPos, leftRing);

      signal = toIndex(reflectorWiring[signal]);

      signal = encodeBackward(signal, 0, leftPos, leftRing);
      signal = encodeBackward(signal, 1, middlePos, middleRing);
      signal = encodeBackward(signal, 2, rightPos, rightRing);

      output += applyPlugboard(toChar(signal));
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

  const resetAll = () => {
    clearResult();
    setCipher("vigenere");
    setMode("encrypt");
    setKey("");
    setEnigmaRotorOrder("I,II,III");
    setEnigmaRingSettings("1,1,1");
    setEnigmaReflector("B");
    setEnigmaPlugboard("");
    setInputText("");
    setSelectedFile(null);
  };

  const copyResult = async () => {
    if (!outputText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);
      setInfoMessage("Hasil teks berhasil disalin ke clipboard.");
    } catch {
      setErrorMessage("Gagal menyalin hasil. Coba salin manual.");
    }
  };

  const processInput = async () => {
    clearResult();
    setIsProcessing(true);

    try {
      if (selectedFile && cipher !== "vigenere") {
        throw new Error(
          "Upload file hanya didukung untuk Vigenere byte-level. Ubah cipher ke Vigenere atau hapus file.",
        );
      }

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
        result = enigma(sanitizedText, {
          positionsKey: key,
          rotorOrder: enigmaRotorOrder,
          ringSettings: enigmaRingSettings,
          reflector: enigmaReflector,
          plugboardPairs: enigmaPlugboard,
        });
      }

      setOutputText(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan.",
      );
    } finally {
      setIsProcessing(false);
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
        placeholder={keyPlaceholder}
      />
      <p className="hint">{keyGuideline}</p>
      {key && !keyValidation.valid && (
        <p className="error key-error">{keyValidation.message}</p>
      )}

      {cipher === "enigma" && (
        <section className="enigma-settings">
          <h2>Pengaturan Enigma I</h2>

          <label htmlFor="enigmaRotorOrder">
            Urutan Rotor (kiri,tengah,kanan):
          </label>
          <input
            id="enigmaRotorOrder"
            type="text"
            value={enigmaRotorOrder}
            onChange={(event) => setEnigmaRotorOrder(event.target.value)}
            placeholder="Contoh: I,II,III"
          />

          <label htmlFor="enigmaRingSettings">Ring Setting (1-26):</label>
          <input
            id="enigmaRingSettings"
            type="text"
            value={enigmaRingSettings}
            onChange={(event) => setEnigmaRingSettings(event.target.value)}
            placeholder="Contoh: 1,1,1"
          />

          <label htmlFor="enigmaReflector">Reflector:</label>
          <select
            id="enigmaReflector"
            value={enigmaReflector}
            onChange={(event) => setEnigmaReflector(event.target.value)}
          >
            <option value="B">Reflector B</option>
            <option value="C">Reflector C</option>
          </select>

          <label htmlFor="enigmaPlugboard">Plugboard (opsional):</label>
          <input
            id="enigmaPlugboard"
            type="text"
            value={enigmaPlugboard}
            onChange={(event) => setEnigmaPlugboard(event.target.value)}
            placeholder="Contoh: AB CD EF"
          />

          <p className="hint">
            Untuk dekripsi Enigma, gunakan konfigurasi yang sama persis dengan
            saat enkripsi.
          </p>
        </section>
      )}

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
      {selectedFile && (
        <p className="hint">File dipilih: {selectedFile.name}</p>
      )}
      {inputText && sanitizedText !== inputText.toUpperCase() && (
        <p className="hint">Karakter non A-Z akan diabaikan saat diproses.</p>
      )}

      <div className="actions">
        <button
          type="button"
          onClick={processInput}
          disabled={!canProcess || isProcessing}
        >
          {isProcessing ? "Memproses..." : "Proses"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={copyResult}
          disabled={!outputText}
        >
          Salin Hasil
        </button>
        <button type="button" className="secondary" onClick={resetAll}>
          Reset
        </button>
      </div>

      <section id="output" aria-live="polite">
        {errorMessage && <p className="error">{errorMessage}</p>}
        {infoMessage && !errorMessage && <p className="info">{infoMessage}</p>}
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
