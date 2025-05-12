import { log } from './logger';

// Simple algorithme de recherche floue basé sur la distance de Levenshtein
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function fuzzySearch(query: string, choices: string[]): string | null {
  if (!query || !choices.length) return null;

  const normalizedQuery = query.toLowerCase().trim();
  let bestMatch: string | null = null;
  let highestScore = 0;

  for (const choice of choices) {
      const normalizedChoice = choice.toLowerCase().trim();
      
      // Vérifier si tous les mots de la requête sont présents dans le choix
      const queryWords = normalizedQuery.split(/\s+/);
      const allWordsPresent = queryWords.every(word => normalizedChoice.includes(word));
      if (allWordsPresent) {
          // Score basé sur la proportion de mots correspondants
          const choiceWords = normalizedChoice.split(/\s+/);
          const score = queryWords.length / (choiceWords.length || 1);
          if (score > highestScore) {
              highestScore = score;
              bestMatch = choice;
          }
          continue;
      }

      // Distance de Levenshtein comme secours
      const maxLength = Math.max(normalizedQuery.length, normalizedChoice.length);
      let distance = 0;
      for (let i = 0; i < Math.min(normalizedQuery.length, normalizedChoice.length); i++) {
          if (normalizedQuery[i] !== normalizedChoice[i]) distance++;
      }
      distance += maxLength - Math.min(normalizedQuery.length, normalizedChoice.length);

      const score = 1 - distance / maxLength;
      if (score > highestScore && score > 0.4) { // Seuil réduit à 0.4
          highestScore = score;
          bestMatch = choice;
      }
  }

  return bestMatch;
}