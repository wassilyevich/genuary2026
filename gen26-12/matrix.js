function mult(m1, m2) {
    const nR1 = m1.length;
    const nR2 = m2.length;
    const nC1 = m1[0].length;
    const nC2 = m2[0].length;
    // Verify that the inputted dimensions are compatible with matrix multpliciation
    if (nC1 !== nR2) {
        console.warn(
            "Number of columns of matrix 1 is not equal to number of rows of matrix 2!",
        );
        return;
    }
    // Verify of all row entries have as many column entries as the first entry
    for (const row of m1) {
        if (row.length !== nC1) {
            console.warn(
                "Not all row entries have as many column entries as the first entry for MATRIX 1.",
            );
            return;
        }
    }
    for (const row of m2) {
        if (row.length !== nC2) {
            console.warn(
                "Not all row entries have as many column entries as the first entry for MATRIX 2.",
            );
            return;
        }
    }
    // Start actual multipliciation
    // m1 = m x n
    // m2 = n x p
    // result = m x p
    // result(ij) = som voor (r-->n) air*brj
    let result = [];
    for (let i = 0; i < nR1; i++) {
        let row = [];
        for (let j = 0; j < nC2; j++) {
            let sum = 0;
            for (let k = 0; k < nC1; k++) {
                sum += m1[i][k] * m2[k][j];
            }
            row.push(sum);
        }
        result.push(row);
    }
    return result;
}

module.exports = { mult };
