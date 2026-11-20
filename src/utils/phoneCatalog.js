// Catalogue des téléphones pour les listes déroulantes : Marque → Modèle → ['Série|Code1,Code2'].
// Sources : carnet de la boutique (Infinix Hot), listes de codes excellentphonerepairs.com (Tecno,
// Infinix, Itel, août 2024), DeviceAtlas (Villaon, Oale). Les séries plus récentes et les codes
// marqués « à vérifier » viennent d'autres connaissances : à confirmer par la boutique.
// Pour ajouter un téléphone : ajouter 'Série|Code' (ou 'Série' si le code est inconnu) au bon modèle.
export const PHONE_CATALOG = {
  Tecno: {
    Camon: ['11|CF7', '11 Pro|CF8', '12|CC7', '12 Air|CC6', '12 Pro|CC9', '15|CD7', '15 Air|CD6', '15 Pro|CD8', '15 Premier|CD8j', '16|CE7', '16 S|CD6j', '16 Pro|CE8', '16 Premier|CE9', '17|CG6', '17P|CG7', '17 Pro|CG8', '18|CH6', '18T|CH6h', '18P|CH7', '18 Premier|CH9', '19|CI6', '19 Neo|CH6i', '19 Pro|CI8', '19 Pro 5G|CI7n', '20|CK6', '20 Pro|CK7n', '20 Pro 5G|CK8n', '20 Premier 5G|CK9n', '30|CL6', '30 5G|CL7', '30 Pro 5G|CL8', '30 Premier 5G|CL9', '30S Pro|CLA6', '40', '40 Pro'],
    'Camon i': ['2|ID5a', '2X|ID5b', '4|CB7', 'Air|IN3'],
    // Codes Spark : seuls 4 Lite et 20C sont confirmés par une source ; les autres sont à vérifier
    Spark: ['4|KC2', '4 Lite|BB4k', '5|KD7', '5 Pro|KD8', '6|KE7', '6 Go|KE5', '7|KF6', '7 Pro|KF8', '8|KG6', '8C|KG5', '8 Pro|KG8', '9', '9 Pro|KH7', '10', '10C|KI5k', '10 Pro|KI7', '20|KJ5', '20C|BG7n', '20 Pro|KJ6', '30', '30C', '40'],
    'Spark Go': ['2023|BF7n', '2024|BG6'],
    Pova: ['1|LD7', 'Neo|LE6', 'Neo 2|LG6n', 'Neo 3|LH6n', '2|LE7', '3|LF7', '4|LG7n', '4 Pro|LG8n', '5|LH7n', '5 Pro 5G|LH8n', '6|LI7', '6 Neo|LI6', '6 Pro 5G|LI9'],
    Pop: ['1|F3', '1s|F4', '2|B1', '2F|B1f', '2 Power|B1p', '2 Pro|B2', '2 Plus|BA2', '2 Air|SA7S', '2X|RB7S', '3|BB2', '3 Plus|BB4', '4|BC2', '4 Air|BC1', '4 LTE|BC1s', '4 Pro|BC3', '5|BD2', '5 Go|BD1', '5P|BD3', '5 LTE|BD4', '5 Pro|BD4h', '6|BE7', '6 Go|BE6', '6 Pro|BE8', '7|BF6', '7 Pro|BF7h', '8|BG6h', '8 Pro|BF7', '9'],
    Pouvoir: ['1|LA6', '2|LA7', '2 Air|LB6', '3|LB7', '3 Plus|LB8', '3 Air|LC6', '4|LC7', '4 Pro|LC8'],
    Phantom: ['6|A6', '6 Plus|A9', '8|AX8', '8S|AX8S', '9|AB7', 'X|AC8', 'X2 5G|AD8', 'X2 Pro 5G|AD9', 'V Fold 5G|AD10', 'V Flip 5G|AD11', 'V Fold2 5G|AE10', 'V Flip2 5G|AE11'],
  },
  Infinix: {
    // Codes du carnet de la boutique, complétés par la liste de codes
    Hot: ['2|X510', '3|X553', '4|X557', '4 Pro|X556', '5|X559', '6|X606', '6 Pro|X608', '6X|X623', '7|X624', '7 Pro|X625', '8|X650', '8 Lite|X650', '9|X655', '9 Pro|X655F', '9 Play|X680', '10|X682', '10i|X659,X658', '10S|X689', '10T|X689', '10 Play|X688', '11|X662,X689F', '11i|X662', '11S|X6812', '12|X6817', '12i|X665', '12 Pro|X668', '12 Play|X6816', '20|X6826', '20i|X665C', '20S|X6827', '20 Play|X6825', '20 5G|X666', '30|X6831', '30i|X669', '30 Play|X6835', '30 5G|X6832', '40|X6836', '40i|X6528', '40 Pro|X6837', '50|X6882B', '50i|X6882', '50 4G|X6882', '50 5G|X6720', '60|X6726', '60i|X6728'],
    Smart: ['2|X5515', '2 HD|X609', '3|X5516', '3 Plus|X627', '4|X653', '4 Plus|X680D', '5|X657B,X657C', '6|X6511', '6 Plus|X6823', '6 HD|X6512', '7|X6515', '7 HD|X6516', '8|X6525', '8 Pro|X6525B', '8 Plus|X6526', '9'],
    Note: ['2|X600', '4|X572', '4 Pro|X571', '5|X604', '5 Stylus|X605', '6|X610', '7|X690', '7 Lite|X656', '8|X692', '8i|X683', '10|X693', '10 Pro|X695', '11|X663B', '11 Pro|X697', '11S|X698', '12|X663,X670', '12 5G|X671', '12 Pro|X676B', '12 Pro 5G|X671B', '12 VIP|X672', '12i|X6819', '30|X6833B', '30i|X6716', '30 5G|X6711', '30 Pro|X678B', '30 VIP|X6710', '40|X6853', '40 Pro|X6850', '40S|X6850B', '40 5G|X6852', '40 Pro 5G|X6851', '40X 5G|X6838'],
    S: ['2|X522', '4|X626', '5|X652', '5 Pro|X660'],
    Zero: ['2|X509', '3|X552', '4|X555', '5|X603', '8', 'X', '20', '30', '40'],
    GT: ['10 Pro|X6739', '20 Pro|X6871'],
  },
  Itel: {
    A: ['A04|A632W', 'A05s|A663L', 'A06|A669W', 'A14 Plus|W4002', 'A16 Plus|A510W', 'A17|W5006X', 'A18|A512W', 'A23 Pro|L5006S', 'A24|A507LN', 'A24 Pro|A511LP', 'A25|L5002', 'A26|A571L', 'A33|W5001P', 'A33 Plus|A509W', 'A35|W5002', 'A36|W5505', 'A37|A571W', 'A44 Air|L5502', 'A46|L5503', 'A47|L5505', 'A48|L6006', 'A49 Play|A631L', 'A50|A667L', 'A50C|A669L', 'A55|W6003', 'A55 LTE|L6003P', 'A56|W6004', 'A56 LTE|L6004', 'A56 Pro|W6004P', 'A57|A611W', 'A58 Lite|A631W', 'A58 Pro|A661W', 'A60|A662L', 'A60s|A662LM', 'A70|A665L', 'A80|A671LC'],
    P: ['P17|P551W', 'P17 Pro|P552W', 'P33|W5504', 'P33 Plus|W6001', 'P36 Play|L6005', 'P37|P651W', 'P38|P661W', 'P38 Pro|P682L', 'P40|P662LN', 'P40+|P683L', 'P55|P665L,A666L', 'P55+|P663L', 'P55 5G|P661N', 'P65|P671L', 'P65C|P666L'],
    S: ['S15|W6002E', 'S16', 'S17', 'S18', 'S23', 'S24', 'S25'],
    Vision: ['1', '1 Plus', '2', '3', '3 Plus|P682LPN', '5 Plus|P681L'],
    Power: ['50|P663LN'],
  },
  Redmi: {
    Redmi: ['9', '9A', '9C', '9T', '10', '10A', '10C', '12', '12C', '13', '13C', '14C', 'A1', 'A2', 'A3', 'A5'],
    Note: ['8', '8 Pro', '9', '9S', '9 Pro', '10', '10S', '10 Pro', '11', '11S', '11 Pro', '12', '12 Pro', '13', '13 Pro', '14', '14 Pro'],
  },
  Samsung: {
    'Galaxy A': ['A01', 'A02', 'A02s', 'A03', 'A03s', 'A04', 'A04s', 'A05', 'A05s', 'A06', 'A10', 'A10s', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A20', 'A20s', 'A21s', 'A22', 'A23', 'A24', 'A25', 'A26', 'A30', 'A30s', 'A31', 'A32', 'A33', 'A34', 'A35', 'A36', 'A50', 'A51', 'A52', 'A53', 'A54', 'A55', 'A56', 'A70', 'A71', 'A72', 'A73'],
    'Galaxy S': ['S8', 'S9', 'S10', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25'],
    'Galaxy Note': ['8', '9', '10', '20'],
  },
  Huawei: {
    Y: ['Y5', 'Y6', 'Y6 Prime', 'Y7', 'Y7 Prime', 'Y9', 'Y9 Prime'],
    P: ['P Smart', 'P20', 'P20 Lite', 'P30', 'P30 Lite', 'P40', 'P40 Lite'],
    Nova: ['3', '3i', '5T', '7', '7i', '9', '10', '11', '12'],
  },
  Honor: {
    X: ['X5', 'X6', 'X6a', 'X7', 'X7a', 'X8', 'X8a', 'X9', 'X9a'],
    Magic: ['4', '5', '6', '7'],
  },
  Oppo: {
    A: ['A5s', 'A15', 'A16', 'A17', 'A18', 'A38', 'A54', 'A57', 'A58', 'A60', 'A78'],
    Reno: ['5', '6', '7', '8', '10', '11', '12', '13'],
  },
  Pixel: {
    Pixel: ['4a', '5', '6', '6a', '7', '7a', '8', '8a', '9', '9a', '10'],
  },
  // Noms relevés sur DeviceAtlas, sans codes
  Villaon: {
    V: ['20', '20 SE', '30', '40s', '40RS', '50s', '100', '101', '105', '112', '120', '200', '200S', '210', '211', '213', '220', '230'],
    Pock: ['1'],
  },
  Oale: {
    Apex: ['1', '2', '3'],
    X: ['1', '1 Plus', '2', '3', '4', '5'],
    XS: ['1', '2', '2 Pro', '3', '5'],
    P: ['1', '2', '3', '5', '5s', '6', '6S'],
    PP: ['1', '2', '3'],
    CC: ['1', '1 Pro', '2', '2 Pro', '3', '5', '6 Pro'],
    Pop: ['8', '8 Pro', '9'],
    Max: ['8', '11', '20'],
    Note: ['10 Pro', '13 Pro', '13 Pro+', '20'],
  },
  iPhone: {
    iPhone: ['6', '6s', '7', '7 Plus', '8', '8 Plus', 'X', 'XR', 'XS', 'XS Max', 'SE 2020', 'SE 2022', '11', '11 Pro', '11 Pro Max', '12', '12 Mini', '12 Pro', '12 Pro Max', '13', '13 Mini', '13 Pro', '13 Pro Max', '14', '14 Plus', '14 Pro', '14 Pro Max', '15', '15 Plus', '15 Pro', '15 Pro Max', '16', '16e', '16 Plus', '16 Pro', '16 Pro Max', '17', '17 Air', '17 Pro', '17 Pro Max'],
  },
  Realme: {
    C: ['C11', 'C15', 'C21', 'C21Y', 'C25', 'C30', 'C31', 'C33', 'C35', 'C51', 'C53', 'C55', 'C61', 'C63', 'C65', 'C67', 'C75'],
    Realme: ['8', '9', '10', '11', '12', '13', '14'],
    Note: ['50', '60'],
  },
};

// Retrouve la clé existante sans tenir compte des majuscules (« tecno » → « Tecno »)
const keyIn = (obj, name) =>
  Object.keys(obj).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;

/**
 * Catalogue complet { marque: { modèle: { série: [codes] } } } :
 * PHONE_CATALOG + les téléphones déjà enregistrés en base (saisis via « Autre… »).
 * `rows` : [{ phone_brand, phone_model, phone_series, phone_code }]
 */
export function buildCatalog(rows = []) {
  const catalog = {};
  const add = (brand, model, series, code) => {
    brand = brand?.trim();
    if (!brand) return;
    const models = (catalog[keyIn(catalog, brand)] ??= {});
    model = model?.trim();
    if (!model) return;
    const allSeries = (models[keyIn(models, model)] ??= {});
    series = series?.trim();
    if (!series) return;
    const codes = (allSeries[keyIn(allSeries, series)] ??= []);
    code = code?.trim();
    if (code && !codes.some((c) => c.toLowerCase() === code.toLowerCase())) codes.push(code);
  };

  for (const [brand, models] of Object.entries(PHONE_CATALOG)) {
    add(brand);
    for (const [model, list] of Object.entries(models)) {
      add(brand, model);
      list.forEach((entry) => {
        const [series, codes = ''] = entry.split('|');
        add(brand, model, series);
        codes.split(',').forEach((code) => add(brand, model, series, code));
      });
    }
  }
  rows.forEach((r) => add(r.phone_brand, r.phone_model, r.phone_series, r.phone_code));
  return catalog;
}
