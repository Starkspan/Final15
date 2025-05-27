const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());

const API_KEY = "K81799995088957"; // OCR.space API-Key

app.post('/analyze', upload.single('file'), async (req, res) => {
    try {
        const filePath = req.file.path;

        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('OCREngine', '2');
        formData.append('scale', 'true');

        const response = await fetch("https://api.ocr.space/parse/image", {
            method: 'POST',
            headers: { apikey: API_KEY },
            body: formData
        });

        const result = await response.json();
        fs.unlinkSync(filePath); // Datei löschen nach Analyse

        const parsedText = result.ParsedResults?.[0]?.ParsedText || "";

        // Einfache Extraktion – später durch KI ersetzen
        const materialMatch = parsedText.match(/1\.[0-9]+\s?[A-Za-z0-9\s]+/);
        const weightMatch = parsedText.match(/Gewicht\s*([0-9\.,]+)\s*kg/i);
        const numberMatch = parsedText.match(/Artikel-Nr\.?[:\s]*([A-Z0-9]+)/i);

        const material = materialMatch ? materialMatch[0] : "-";
        // Kundenangaben
        const selectedMaterial = req.body.material;
        const length = parseFloat(req.body.length || 0);
        const width = parseFloat(req.body.width || 0);
        const height = parseFloat(req.body.height || 0);

        // Dichten in g/cm³ → kg/dm³ → kg/L
        const materialDensity = {
            aluminium: 2.7,
            stahl: 7.85,
            edelstahl: 7.9,
            messing: 8.5,
            kupfer: 8.96
        };

        const pricePerKg = {
            aluminium: 7,
            stahl: 1.5,
            edelstahl: 6.5,
            messing: 8,
            kupfer: 10
        };

        const density = materialDensity[selectedMaterial] || 7.85;
        const €/kg = pricePerKg[selectedMaterial] || 2.0;

        const volume_cm3 = length * width * height; // mm³
        const weight = (volume_cm3 / 1000) * density; // in g → /1000 → kg
        const materialCost = weight * €/kg;

        // CNC-Kalkulation
        const rüst = 60;
        const programm = 30;
        const cncZeitMin = 10; // Platzhalter
        const cncKosten = (cncZeitMin / 60) * 35;
        const kostenNetto = materialCost + cncKosten + rüst + programm;
        const preisBrutto = kostenNetto * 1.15;

        return res.json({
            material: selectedMaterial,
            rohgewicht_kg: weight.toFixed(2),
            materialkosten: materialCost.toFixed(2),
            cnc_kosten: cncKosten.toFixed(2),
            gesamtpreis: preisBrutto.toFixed(2),
            erkannterText: parsedText
        });

        const weight = weightMatch ? parseFloat(weightMatch[1].replace(",", ".")) : 0.1;
        const drawingNumber = numberMatch ? numberMatch[1] : "Unbekannt";

        const baseCost = 60 + 30 + (weight * 35); // Rüst + Programmierung + Fertigung
        const margin = 1.15;
        const finalPrice = baseCost * margin;

        const prices = [1, 10, 25, 50, 100].map(qty => ({
            qty,
            price: (finalPrice / Math.pow(qty, 0.35)).toFixed(2)
        }));

        res.json({
            zeichnungsnummer: drawingNumber,
            material,
            gewicht: weight + " kg",
            staffelpreise: prices
        });
    } catch (err) {
        res.status(500).json({ error: "Analysefehler: " + err.message });
    }
});

app.listen(10000, () => {
    console.log("✅ Starkspan V12 Backend läuft auf Port 10000");
});