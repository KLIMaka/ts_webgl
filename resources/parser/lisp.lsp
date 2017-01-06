(+ 12 55 1 2 5 4)
(set a (+ 10 20))
a
set
'(set a (+ 11 22))
(set fact (lambda n 
  (if n 
    (+ n (fact (- n 1))))
    0
  )
)
(fact 500)