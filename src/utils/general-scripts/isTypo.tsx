export function isTypo(
  inputWord: string,
  targetWord: string,
  maxDistance: number
): boolean {
  if (Math.abs(inputWord.length - targetWord.length) > maxDistance) {
    // Wenn die Längen der Wörter zu unterschiedlich sind, ist es kein Tippfehler.
    return false;
  }

  const dp: number[][] = [];
  for (let i = 0; i <= inputWord.length; i++) {
    dp[i] = [i];
  }

  for (let j = 1; j <= targetWord.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= inputWord.length; i++) {
    for (let j = 1; j <= targetWord.length; j++) {
      const cost = inputWord[i - 1] === targetWord[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // Deletion
        dp[i][j - 1] + 1, // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return dp[inputWord.length][targetWord.length] <= maxDistance;
}
