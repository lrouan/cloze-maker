import fs from 'fs';
import path from 'path';
import os from 'os';
import { simplify, pinyinify } from 'hanzi-tools';

const getDateTag = () => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `copypaste_${year}${month}${day}_${Date.now()}`;
};
// call it so the file has access to a consistent date tag
const dateTag = getDateTag();

const endMarkerIndex = (list) => {
  console.log('list....', list);
  const endItemIndex = list.findIndex((element) => {
    const trunc = element.slice(0, 3);
    if (trunc.includes('end')) return true;
    return false;
  });
  return endItemIndex;
};

const getNewFlashcardDeck = (list) => {
  // first search if there is a word item named 'end'
  // if found, return all following items as the active deck
  const endItemIndex = endMarkerIndex(list);
  return list.slice(endItemIndex + 1);
};

const buildFlashcardFields = async (list) => {
  list.pop(); // remove last empty line
  list.shift(); // remove header
  const newCards = getNewFlashcardDeck(list);
  // handle case if no new cards found
  if (newCards.length === 0) {
    console.log('No new flashcards found.');
    return;
  }

  console.log(newCards);
  // only allow on cloze deletion per card for now
  const strArray = Promise.all(
    newCards.map(async (el) => {
      const flashcardArr = el.split('|');
      const word = flashcardArr[0].trim();
      const sentence = flashcardArr[1].trim();
      const translation = flashcardArr[2].trim();

      const hanziMatchIndex = sentence.indexOf(word) !== -1;
      let clozeSentence;
      if (hanziMatchIndex) {
        clozeSentence = sentence.replace(word, `{{c1::${word}}}`);
      }

      const simplifiedSentence = simplify(sentence);
      const pinyinified = pinyinify(simplifiedSentence, true);
      const { pinyinSegments } = pinyinified;
      const simplifiedWord = simplify(word);
      const pinyinWord = pinyinify(simplifiedWord);

      const pinyinMatchIndex = pinyinSegments.indexOf(pinyinWord);
      if (pinyinMatchIndex !== -1) {
        pinyinSegments[pinyinMatchIndex] = `{{c1::${pinyinWord}}}`;
      }
      const clozePinyin = pinyinSegments.join(' ').trim();
      console.log({ clozeSentence, pinyinWord, pinyinSegments, clozePinyin });
      return `${clozeSentence} | ${clozePinyin} | ${translation} | ${dateTag}`;
    })
  );
  return strArray;
};

const writeToCSV = (list, fileName) => {
  const csvData = list.join('\n');
  fs.writeFile(fileName, csvData, (err) => {
    if (err) console.error(err);
    console.log('OK');
  });
};

const openCSVToArray = async (fileName) => {
  try {
    const data = await fs.readFileSync(fileName, 'utf8');
    const list = data.split('\n');
    return list;
  } catch (err) {
    console.error(err);
    return [];
  }
};

const main = async () => {
  const fileName = `sentence_flashcards.csv`;
  const wordList = await openCSVToArray(fileName);
  const newCards = await buildFlashcardFields(wordList);
  console.log(wordList, '\n\n', newCards);
  if (newCards) {
    try {
      const newCardsFile = path.join(
        os.homedir(),
        'Documents/Taiwan/Chinese/Copy-Paste-Chinese-Course/Anki/',
        `${dateTag}_anki_sentences.csv`
      );
      writeToCSV(newCards, newCardsFile);
    } catch (err) {
      console.error('error writing new cards file:', err);
      return;
    }
  }
  try {
    // IF the new list succeeds to save to a new file
    // THEN add a new 'end' marker to the original file
    const endItemIndex = endMarkerIndex(wordList);
    if (endItemIndex !== -1) {
      wordList.splice(endItemIndex, 1); // remove existing 'end' marker
    }
    wordList.pop(); // remove last empty line
    wordList.push(`end||`);
    writeToCSV(wordList, fileName);
  } catch (err) {
    console.log('Failed to add end marker to original file');
    console.error(err);
  }
};

main();

/*    

INPUT:
Fields:
Word | Sentence | Translation

Examples:
幾 | 你今年幾歲？ | How old are you this year?


OUTPUT:
Fields:
Word | Sentence | Pinyin | Translation | Tags

Examples:
幾 | 你今年幾歲？ | nǐ jīnnián jǐ suì? | How old are you this year? | copypaste_w1

Example cloze deletion fields:
Hanzi Sentence: 
  你{{c1::去}}哪裡
Pinyin: 
  Nǐ {{c2::qù}} nǎlǐ
    */
