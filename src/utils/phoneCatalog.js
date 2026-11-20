// Catalogue des téléphones pour les listes déroulantes : Marque → Modèle → Série (|Code).
// Codes Infinix Hot repris du carnet de la boutique ; les autres sont à faire vérifier par la boutique.
// Pour ajouter un téléphone : ajouter 'Série|Code' (ou 'Série' si le code est inconnu) au bon modèle.
export const PHONE_CATALOG = {
  Tecno: {
    Camon: ['11|CF7', '12|CC7', '12 Air|CC6', '15|CD7', '15 Premier|CD8', '16|CE7', '16 Premier|CE9', '17|CG6', '17P|CG7', '18|CH6', '18P|CH7', '19|CI6n', '19 Pro|CI8', '20|CK6n', '20 Pro|CK7n', '30|CL6', '30 Pro', '40', '40 Pro'],
    Spark: ['4|KC2', '5|KD7', '5 Pro|KD8', '6|KE7', '6 Go|KE5', '7|KF6', '7 Pro|KF8', '8|KG6', '8C|KG5', '8 Pro|KG8', '9', '9 Pro|KH7', '10', '10C|KI5k', '10 Pro|KI7', '20|KJ5', '20C|BG7', '20 Pro|KJ6', '30', '30C'],
    Pova: ['1|LD7', '2|LE7', '3|LF7', '4|LG7n', '5|LH7n', '6 Pro'],
    Pop: ['2|B1', '4|BC2', '5|BD2', '6', '7|BF6', '8|BG6'],
    Pouvoir: ['3|LB7', '4|LC7'],
    Phantom: ['9|AB7', 'X|AC8', 'X2', 'V Fold', 'V Flip'],
  },
  Infinix: {
    Hot: ['4|X557', '5|X559', '6|X606', '6 Pro|X608', '6X|X623', '7|X624', '7 Pro|X625', '8|X650', '9|X655', '9 Play|X680', '10|X682', '10i|X659', '10T|X689', '10 Play|X688', '11|X662', '11S|X6812', '12|X6817', '12i|X665', '12 Pro|X668', '12 Play|X6816', '20|X6826', '20 Play|X6825', '20 5G|X666', '30|X6831', '30i|X669', '30 Play|X6835', '40|X6836', '40i|X6528', '40 Pro|X6837', '50 4G|X6882', '50 5G|X6720', '60|X6726', '60i|X6728'],
    Smart: ['3 Plus|X627', '4|X653', '5|X657', '6|X6511', '7|X6515', '8|X6525', '9'],
    Note: ['7|X690', '8|X692', '10|X693', '10 Pro|X695', '11|X663', '11 Pro|X697', '12|X676B', '12 G96|X670', '30|X6833B', '30 Pro|X678B', '40|X6853', '40 Pro|X6850'],
    S: ['4|X626', '5|X652', '5 Lite', '5 Pro'],
    Zero: ['8', 'X', '20', '30', '40'],
  },
  Itel: {
    A: ['A16', 'A25', 'A26', 'A37', 'A48', 'A49', 'A56', 'A58', 'A60', 'A70'],
    P: ['P36', 'P37', 'P40', 'P55'],
    S: ['S15', 'S16', 'S17', 'S18', 'S23', 'S24'],
    Vision: ['1', '1 Plus', '2', '3'],
  },
  Redmi: {
    Redmi: ['9', '9A', '9C', '10', '10A', '10C', '12', '12C', '13', '13C', '14C', 'A1', 'A2', 'A3'],
    Note: ['8', '9', '10', '11', '12', '13', '14'],
  },
  Samsung: {
    'Galaxy A': ['A02', 'A03', 'A04', 'A05', 'A10', 'A12', 'A13', 'A14', 'A15', 'A16', 'A20', 'A21s', 'A22', 'A23', 'A24', 'A25', 'A30', 'A31', 'A32', 'A33', 'A34', 'A35', 'A50', 'A51', 'A52', 'A53', 'A54', 'A55'],
    'Galaxy S': ['S10', 'S20', 'S21', 'S22', 'S23', 'S24'],
  },
  Huawei: {
    Y: ['Y5', 'Y6', 'Y7', 'Y9'],
    P: ['P20', 'P30', 'P40'],
    Nova: ['3', '5', '7', '9'],
  },
  Honor: {
    X: ['X6', 'X7', 'X8', 'X9'],
    Magic: ['5', '6'],
  },
  Oppo: {
    A: ['A5s', 'A15', 'A16', 'A17', 'A18', 'A38', 'A57', 'A58', 'A78'],
    Reno: ['5', '6', '7', '8', '10', '11'],
  },
  Pixel: {
    Pixel: ['4a', '5', '6', '6a', '7', '7a', '8', '8a', '9'],
  },
  Villaon: {},
  Oale: {},
  iPhone: {
    iPhone: ['6', '6s', '7', '7 Plus', '8', '8 Plus', 'X', 'XR', 'XS', 'XS Max', '11', '11 Pro', '11 Pro Max', '12', '12 Pro', '12 Pro Max', '13', '13 Pro', '13 Pro Max', '14', '14 Pro', '14 Pro Max', '15', '15 Pro', '15 Pro Max', '16', '16 Pro', '16 Pro Max'],
  },
  Realme: {
    C: ['C11', 'C21', 'C25', 'C30', 'C31', 'C33', 'C35', 'C51', 'C53', 'C55', 'C61', 'C63'],
    Realme: ['8', '9', '10', '11', '12'],
    Note: ['50'],
  },
};

// [{ series, code }] d'un modèle
export const seriesOf = (brand, model) =>
  (PHONE_CATALOG[brand]?.[model] || []).map((s) => {
    const [series, code = ''] = s.split('|');
    return { series, code };
  });
