// VOICEVOX/voicevox_vvm (https://github.com/VOICEVOX/voicevox_vvm) の
// README記載の「音声モデル(VVMファイル)と声キャラクタースタイルの対応表」のうち、
// トーク用(ファイル名が数字のみ)のVVMファイルだけを抜き出したカタログ。
// ソング用(s接頭辞)・Nemo用(n接頭辞)は会話アプリでは使わないため含めていない。
// 新しいVVMが追加された場合は、上記READMEの対応表を見て手動で追記すること。
export interface LocalVoicevoxStyleEntry {
  speakerName: string;
  styleName: string;
  styleId: number;
}

export interface LocalVoicevoxVvmEntry {
  /** voicevox_vvmリポジトリ内のファイル名。ダウンロードURLの組み立てに使う */
  vvmFile: string;
  styles: LocalVoicevoxStyleEntry[];
}

export const LOCAL_VOICEVOX_CATALOG: LocalVoicevoxVvmEntry[] = [
  {
    vvmFile: "0.vvm",
    styles: [
      { speakerName: "四国めたん", styleName: "ノーマル", styleId: 2 },
      { speakerName: "四国めたん", styleName: "あまあま", styleId: 0 },
      { speakerName: "四国めたん", styleName: "ツンツン", styleId: 6 },
      { speakerName: "四国めたん", styleName: "セクシー", styleId: 4 },
      { speakerName: "ずんだもん", styleName: "ノーマル", styleId: 3 },
      { speakerName: "ずんだもん", styleName: "あまあま", styleId: 1 },
      { speakerName: "ずんだもん", styleName: "ツンツン", styleId: 7 },
      { speakerName: "ずんだもん", styleName: "セクシー", styleId: 5 },
      { speakerName: "春日部つむぎ", styleName: "ノーマル", styleId: 8 },
      { speakerName: "雨晴はう", styleName: "ノーマル", styleId: 10 },
    ],
  },
  {
    vvmFile: "1.vvm",
    styles: [
      { speakerName: "冥鳴ひまり", styleName: "ノーマル", styleId: 14 },
    ],
  },
  {
    vvmFile: "2.vvm",
    styles: [
      { speakerName: "九州そら", styleName: "ノーマル", styleId: 16 },
      { speakerName: "九州そら", styleName: "あまあま", styleId: 15 },
      { speakerName: "九州そら", styleName: "ツンツン", styleId: 18 },
      { speakerName: "九州そら", styleName: "セクシー", styleId: 17 },
    ],
  },
  {
    vvmFile: "3.vvm",
    styles: [
      { speakerName: "波音リツ", styleName: "ノーマル", styleId: 9 },
      { speakerName: "波音リツ", styleName: "クイーン", styleId: 65 },
      { speakerName: "中国うさぎ", styleName: "ノーマル", styleId: 61 },
      { speakerName: "中国うさぎ", styleName: "おどろき", styleId: 62 },
      { speakerName: "中国うさぎ", styleName: "こわがり", styleId: 63 },
      { speakerName: "中国うさぎ", styleName: "へろへろ", styleId: 64 },
    ],
  },
  {
    vvmFile: "4.vvm",
    styles: [
      { speakerName: "玄野武宏", styleName: "ノーマル", styleId: 11 },
      { speakerName: "剣崎雌雄", styleName: "ノーマル", styleId: 21 },
    ],
  },
  {
    vvmFile: "5.vvm",
    styles: [
      { speakerName: "四国めたん", styleName: "ささやき", styleId: 36 },
      { speakerName: "四国めたん", styleName: "ヒソヒソ", styleId: 37 },
      { speakerName: "ずんだもん", styleName: "ささやき", styleId: 22 },
      { speakerName: "ずんだもん", styleName: "ヒソヒソ", styleId: 38 },
      { speakerName: "九州そら", styleName: "ささやき", styleId: 19 },
    ],
  },
  {
    vvmFile: "6.vvm",
    styles: [
      { speakerName: "No.7", styleName: "ノーマル", styleId: 29 },
      { speakerName: "No.7", styleName: "アナウンス", styleId: 30 },
      { speakerName: "No.7", styleName: "読み聞かせ", styleId: 31 },
    ],
  },
  {
    vvmFile: "7.vvm",
    styles: [
      { speakerName: "後鬼", styleName: "人間ver.", styleId: 27 },
      { speakerName: "後鬼", styleName: "ぬいぐるみver.", styleId: 28 },
    ],
  },
  {
    vvmFile: "8.vvm",
    styles: [
      { speakerName: "WhiteCUL", styleName: "ノーマル", styleId: 23 },
      { speakerName: "WhiteCUL", styleName: "たのしい", styleId: 24 },
      { speakerName: "WhiteCUL", styleName: "かなしい", styleId: 25 },
      { speakerName: "WhiteCUL", styleName: "びえーん", styleId: 26 },
    ],
  },
  {
    vvmFile: "9.vvm",
    styles: [
      { speakerName: "白上虎太郎", styleName: "ふつう", styleId: 12 },
      { speakerName: "白上虎太郎", styleName: "わーい", styleId: 32 },
      { speakerName: "白上虎太郎", styleName: "びくびく", styleId: 33 },
      { speakerName: "白上虎太郎", styleName: "おこ", styleId: 34 },
      { speakerName: "白上虎太郎", styleName: "びえーん", styleId: 35 },
    ],
  },
  {
    vvmFile: "10.vvm",
    styles: [
      { speakerName: "玄野武宏", styleName: "喜び", styleId: 39 },
      { speakerName: "玄野武宏", styleName: "ツンギレ", styleId: 40 },
      { speakerName: "玄野武宏", styleName: "悲しみ", styleId: 41 },
      { speakerName: "ちび式じい", styleName: "ノーマル", styleId: 42 },
    ],
  },
  {
    vvmFile: "11.vvm",
    styles: [
      { speakerName: "櫻歌ミコ", styleName: "ノーマル", styleId: 43 },
      { speakerName: "櫻歌ミコ", styleName: "第二形態", styleId: 44 },
      { speakerName: "櫻歌ミコ", styleName: "ロリ", styleId: 45 },
      { speakerName: "ナースロボ＿タイプＴ", styleName: "ノーマル", styleId: 47 },
      { speakerName: "ナースロボ＿タイプＴ", styleName: "楽々", styleId: 48 },
      { speakerName: "ナースロボ＿タイプＴ", styleName: "恐怖", styleId: 49 },
      { speakerName: "ナースロボ＿タイプＴ", styleName: "内緒話", styleId: 50 },
    ],
  },
  {
    vvmFile: "12.vvm",
    styles: [
      { speakerName: "†聖騎士 紅桜†", styleName: "ノーマル", styleId: 51 },
      { speakerName: "雀松朱司", styleName: "ノーマル", styleId: 52 },
      { speakerName: "麒ヶ島宗麟", styleName: "ノーマル", styleId: 53 },
    ],
  },
  {
    vvmFile: "13.vvm",
    styles: [
      { speakerName: "春歌ナナ", styleName: "ノーマル", styleId: 54 },
      { speakerName: "猫使アル", styleName: "ノーマル", styleId: 55 },
      { speakerName: "猫使アル", styleName: "おちつき", styleId: 56 },
      { speakerName: "猫使アル", styleName: "うきうき", styleId: 57 },
      { speakerName: "猫使ビィ", styleName: "ノーマル", styleId: 58 },
      { speakerName: "猫使ビィ", styleName: "おちつき", styleId: 59 },
      { speakerName: "猫使ビィ", styleName: "人見知り", styleId: 60 },
    ],
  },
  {
    vvmFile: "14.vvm",
    styles: [
      { speakerName: "栗田まろん", styleName: "ノーマル", styleId: 67 },
      { speakerName: "あいえるたん", styleName: "ノーマル", styleId: 68 },
      { speakerName: "満別花丸", styleName: "ノーマル", styleId: 69 },
      { speakerName: "満別花丸", styleName: "元気", styleId: 70 },
      { speakerName: "満別花丸", styleName: "ささやき", styleId: 71 },
      { speakerName: "満別花丸", styleName: "ぶりっ子", styleId: 72 },
      { speakerName: "満別花丸", styleName: "ボーイ", styleId: 73 },
      { speakerName: "琴詠ニア", styleName: "ノーマル", styleId: 74 },
    ],
  },
  {
    vvmFile: "15.vvm",
    styles: [
      { speakerName: "ずんだもん", styleName: "ヘロヘロ", styleId: 75 },
      { speakerName: "ずんだもん", styleName: "なみだめ", styleId: 76 },
      { speakerName: "青山龍星", styleName: "ノーマル", styleId: 13 },
      { speakerName: "青山龍星", styleName: "熱血", styleId: 81 },
      { speakerName: "青山龍星", styleName: "不機嫌", styleId: 82 },
      { speakerName: "青山龍星", styleName: "喜び", styleId: 83 },
      { speakerName: "青山龍星", styleName: "しっとり", styleId: 84 },
      { speakerName: "青山龍星", styleName: "かなしみ", styleId: 85 },
      { speakerName: "青山龍星", styleName: "囁き", styleId: 86 },
      { speakerName: "もち子さん", styleName: "ノーマル", styleId: 20 },
      { speakerName: "もち子さん", styleName: "セクシー／あん子", styleId: 66 },
      { speakerName: "もち子さん", styleName: "泣き", styleId: 77 },
      { speakerName: "もち子さん", styleName: "怒り", styleId: 78 },
      { speakerName: "もち子さん", styleName: "喜び", styleId: 79 },
      { speakerName: "もち子さん", styleName: "のんびり", styleId: 80 },
      { speakerName: "小夜/SAYO", styleName: "ノーマル", styleId: 46 },
    ],
  },
  {
    vvmFile: "16.vvm",
    styles: [
      { speakerName: "後鬼", styleName: "人間（怒り）ver.", styleId: 87 },
      { speakerName: "後鬼", styleName: "鬼ver.", styleId: 88 },
    ],
  },
  {
    vvmFile: "17.vvm",
    styles: [
      { speakerName: "Voidoll", styleName: "ノーマル", styleId: 89 },
    ],
  },
  {
    vvmFile: "18.vvm",
    styles: [
      { speakerName: "ぞん子", styleName: "ノーマル", styleId: 90 },
      { speakerName: "ぞん子", styleName: "低血圧", styleId: 91 },
      { speakerName: "ぞん子", styleName: "覚醒", styleId: 92 },
      { speakerName: "ぞん子", styleName: "実況風", styleId: 93 },
      { speakerName: "中部つるぎ", styleName: "ノーマル", styleId: 94 },
      { speakerName: "中部つるぎ", styleName: "怒り", styleId: 95 },
      { speakerName: "中部つるぎ", styleName: "ヒソヒソ", styleId: 96 },
      { speakerName: "中部つるぎ", styleName: "おどおど", styleId: 97 },
      { speakerName: "中部つるぎ", styleName: "絶望と敗北", styleId: 98 },
    ],
  },
  {
    vvmFile: "19.vvm",
    styles: [
      { speakerName: "離途", styleName: "ノーマル", styleId: 99 },
      { speakerName: "離途", styleName: "シリアス", styleId: 101 },
      { speakerName: "黒沢冴白", styleName: "ノーマル", styleId: 100 },
    ],
  },
  {
    vvmFile: "20.vvm",
    styles: [
      { speakerName: "ユーレイちゃん", styleName: "ノーマル", styleId: 102 },
      { speakerName: "ユーレイちゃん", styleName: "甘々", styleId: 103 },
      { speakerName: "ユーレイちゃん", styleName: "哀しみ", styleId: 104 },
      { speakerName: "ユーレイちゃん", styleName: "ささやき", styleId: 105 },
      { speakerName: "ユーレイちゃん", styleName: "ツクモちゃん", styleId: 106 },
    ],
  },
  {
    vvmFile: "21.vvm",
    styles: [
      { speakerName: "猫使アル", styleName: "つよつよ", styleId: 110 },
      { speakerName: "猫使アル", styleName: "へろへろ", styleId: 111 },
      { speakerName: "猫使ビィ", styleName: "つよつよ", styleId: 112 },
      { speakerName: "東北ずん子", styleName: "ノーマル", styleId: 107 },
      { speakerName: "東北きりたん", styleName: "ノーマル", styleId: 108 },
      { speakerName: "東北イタコ", styleName: "ノーマル", styleId: 109 },
    ],
  },
  {
    vvmFile: "22.vvm",
    styles: [
      { speakerName: "あんこもん", styleName: "ノーマル", styleId: 113 },
      { speakerName: "あんこもん", styleName: "つよつよ", styleId: 114 },
      { speakerName: "あんこもん", styleName: "よわよわ", styleId: 115 },
      { speakerName: "あんこもん", styleName: "けだるげ", styleId: 116 },
    ],
  },
  {
    vvmFile: "23.vvm",
    styles: [
      { speakerName: "あんこもん", styleName: "ささやき", styleId: 117 },
    ],
  },
  {
    vvmFile: "24.vvm",
    styles: [
      { speakerName: "夜語トバリ", styleName: "ノーマル", styleId: 118 },
      { speakerName: "夜語トバリ", styleName: "明るい", styleId: 119 },
      { speakerName: "夜語トバリ", styleName: "哀しみ", styleId: 120 },
      { speakerName: "夜語トバリ", styleName: "呆れ", styleId: 121 },
      { speakerName: "暁記ミタマ", styleName: "ノーマル", styleId: 122 },
      { speakerName: "暁記ミタマ", styleName: "怒り", styleId: 123 },
      { speakerName: "暁記ミタマ", styleName: "哀しみ", styleId: 124 },
      { speakerName: "暁記ミタマ", styleName: "ささやき", styleId: 125 },
      { speakerName: "里石ユカ", styleName: "つぼみ", styleId: 126 },
    ],
  },
];
