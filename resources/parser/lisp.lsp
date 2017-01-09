(rest '(1 2 43))
(if 0 1 2)
(+ 12 55 1 2 5 4)
(set a (+ 10 20))
a
set
(list a 'set 11)
'(set a (+ 11 22))
(set fact (lambda n 
  (if n 
    (+ n (fact (+ n -1)))
    0
  )
))
(fact 500)

(set join (lambda l r
	(if (length l)
		(join (rest l) (cons (head l) r))
		r
	)
))

(set reverse (lambda l
	(if (length (rest l))) 
		(cons (reverse (rest l)) (head l))
		(cons (head l) '()))
	)
))

(reverse '(1 2 3 4 5 6))