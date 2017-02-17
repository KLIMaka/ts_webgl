(set rev (lambda l
	(if (length l)
		(append (rev (rest l)) (cons (head l) '()))
		'()
	)
))

(set nth (lambda l n
  (if n
    (nth (rest l) (+ n -1))
    (head l)
  )
))

(set filter (lambda l f
  (if (length l)
    (if (f (head l)) 
      (cons (head l) (filter (rest l) f))
      (filter (rest l) f)
    )
    '()
  )
))


(set qsort (lambda l
  (if (length l)
    (append
      (qsort (filter l (< _0 (head l))))
      (filter l (== _0 (head l)))
      (qsort (filter l (> _0 (head l))))
    )
    '()
  )
))

(qsort '(4 8 4 2 6 5 4 4 7 5 2 54 4 7 4 4  7 5 4 1 1 2 5 4 4  8  5 4 4 4 5 6 99 3 2 1 4 ))
(set inc (+ _0 1))
(inc 12)

(set bigger5 (filter _0 (> _0 5)))
(bigger5 '(1 2 3 4 5 6 7 8 9))