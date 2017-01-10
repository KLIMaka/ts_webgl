(set fact (lambda n 
  (if n 
    (+ n (fact (+ n -1)))
    0
  )
))
(fact 500)

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

(filter '(1 2 3 4 5 6) (lambda x (+ x -2)))