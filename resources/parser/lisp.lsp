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

(qsort '(4 8 4 2 6 5 4 4 7 5 2 54 4 7 4 4 7 5 4 1 1 2 5 4 4 8 5 4 4 4 5 6 99 3 2 1 4))
(set . (lambda f g
  (lambda a (f (g a)))
))
(set inc (+ _0 1))
(set double (* _0 2))
((. double inc) 1)

(set match (lambda arg ms
  (if (length ms)
    (if (eval (head ms) arg)
      (eval (head (rest ms)))
      (match arg (rest (rest ms)))
    )
    0
  )
))

(match 0 '(
  (== _0 0) 1
  (== _0 1) 0
))