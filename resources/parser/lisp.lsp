(set \ lambda)
(set tostr (evaljs "return str(evaluate(l.head()) + '')"))
(set tonum (evaljs "return parseFloat(evaluate(l.head()).str)"))
(set strcmp (evaljs "var lf = evaluate(l.get(0)).str; var r = evaluate(l.get(1)).str; return lf == r ? 0 : lf < r ? -1 : 1"))
(set concat (evaljs "return str(evaluate(l.get(0)).str + '' + evaluate(l.get(1)).str)"))
(set / (evaljs "return evaluate(l.get(0)) / evaluate(l.get(1))"))
(set % (evaljs "return evaluate(l.get(0)) % evaluate(l.get(1))"))
(set + (evaljs "return evaluate(l.get(0)) + evaluate(l.get(1))"))
(set * (evaljs "return evaluate(l.get(0)) * evaluate(l.get(1))"))
(set - (evaljs "return evaluate(l.get(0)) - evaluate(l.get(1))"))
(set > (evaljs "return evaluate(l.get(0)) > evaluate(l.get(1))"))
(set < (evaljs "return evaluate(l.get(0)) < evaluate(l.get(1))"))
(set >= (evaljs "return evaluate(l.get(0)) >= evaluate(l.get(1))"))
(set <= (evaljs "return evaluate(l.get(0)) <= evaluate(l.get(1))"))
(set == (evaljs "return evaluate(l.get(0)) == evaluate(l.get(1))"))
(set != (evaljs "return evaluate(l.get(0)) != evaluate(l.get(1))"))
(set apply (\ f a (eval (cons f (map (\ x (list LST x)) a)))))
(set . (\ f g (\ (f (apply g _args)))))
(set times (\ e n (if n (cons e (times e (- n 1))) `())))
(set decorate_arg (\ f a (\ (apply f (map a _args)))))
(set strpad (\ s p n (if (>= (length s) n) s (concat (join (times p (- n (length s)))) s))))

(set rev (\ l
	(if (length l)
		(append (rev (rest l)) (list (head l)))
		`()
	)
))

(set nth (\ l n
  (if n
    (nth (rest l) (- n 1))
    (head l)
  )
))

(set filter (\ l f
  (let 
    nonempty (length l)
    next     (filter (rest l) f)
    first    (head l)
    pred     (f first)

    (if nonempty
      (if pred 
        (cons first next) 
        next
      )
      `()
    )
  )
))

(set qsort (\ l
  (let
    nonempty (length l)
    pivot    (head l)
    pred     (\ op (op _0 pivot))
    ls       (filter l (pred <))
    eq       (filter l (pred ==))
    gt       (filter l (pred >))

    (if nonempty
      (append 
        (qsort ls)
        eq 
        (qsort gt)
      )
      `()
    )
  )
))

(qsort `(4 8 4 2 6 5 4 4 7 5 2 54 4 7 4 4 7 5 4 1 1 2 5 4 4 8 5 4 4 4 5 6 99 3 2 1 4))

(set match (\ arg ms
  (let
    nonempty (length ms)
    first    (head ms)
    result   ((head (rest ms)))
    tail     (rest (rest ms))
    cond     (first arg)
    next     (match arg tail)
   
    (if nonempty
      (if cond
        result
        next
      )
      0
    )
  )
))

(set fold (\ f l s
  (match (length l) (list
    (== _0 0) (\ s)
    (>  _0 0) (\ (f (head l) (fold f (rest l) s)))
  ))
))

(set fold1 (\ f l
  (match (length l) (list
    (== _0 0) (\ 0)
    (== _0 1) (\ (head l))
    (>  _0 1) (\ (f (head l) (fold1 f (rest l))))
  ))
))
(set join (fold1 concat _0))

(set foldr (\ f l s
  (match (length l) (list
    (== _0 0) (\ s)
    (>  _0 0) (\ (foldr f (rest l) (f s (head l))))
  ))
))

(set foldr1 (\ f l
  (if (length l)
    (foldr f (rest l) (head l))
    0
  )
))

(set map (\ f l
  (if (length l)
    (cons (f (head l)) (map f (rest l)))
    `()
  )
))

(set create_node   (\ l e r (list l e r)))
(set left_subtree  (\ t (head t)))
(set right_subtree (\ t (head (rest (rest t)))))
(set node_value    (\ t (head (rest t))))

(set tree_add (\ t e c
  (let
    nonempty (length t)
    left     (left_subtree t)
    value    (node_value t)
    cmp      (c e value)
    right    (right_subtree t)

    (if nonempty
      (match cmp (list
        (== _0 0) (\ (create_node left e right))
        (>  _0 0) (\ (create_node (tree_add left e c) value right))
        (<  _0 0) (\ (create_node left value (tree_add right e c)))
      ))
      (create_node `() e `())
    )
  )
))

(set tree_get (\ t k c
  (let
    nonempty (length t)
    value    (node_value t)
    cmp      (c k value)
    left     (left_subtree t)
    right    (right_subtree t)

    (if nonempty
      (match cmp (list
        (== _0 0) (\ value)
        (>  _0 0) (\ (tree_get left k c))
        (<  _0 0) (\ (tree_get right k c))
      ))
      `()
    )
  )
))

(set visit_tree (\ t
  (let
    nonempty (length t)
    tail     (rest t)
    left     (visit_tree (left_subtree t))
    right    (visit_tree (right_subtree t))
    nodeval  (list (node_value t))

    (if nonempty
      (append left nodeval right)
      `()
    )
  )
))

(set max (\ a b
  (if (>= a b) a b)
))

(set tree_height (\ t
  (let
    nonempty (length t)
    left     (+ 1 (tree_height (left_subtree t)))
    right    (+ 1 (tree_height (right_subtree t)))

    (if nonempty
      (max left right)
      0
    )
  )
))

(set flatten (\ l
  (let
    nonempty (length l)
    first    (head l)
    tail     (rest l)

    (if nonempty
      (match first (list
        (list? _0) (\ (append (flatten first) (flatten tail)))
        (\ 1)      (\ (cons first (flatten tail)))
      ))
      `()
    )
  )
))

(set tree (fold (tree_add _1 _0 -) `(10 55 87 4 5 45 9 88 4 66 8 5 4 55 9 5 1 2 5 4 77  4) `()))
(tree_height tree)
(rev (visit_tree tree))
(rev (flatten tree))

(set tree_cmp (decorate_arg - head))
(set mtree (fold (tree_add _1 _0 tree_cmp) `((1 "one") (2 "two") (3 "three")) `()))
(set mtree (tree_add mtree `(5 "five") tree_cmp))
(set mtree (tree_add mtree `(5 "five1") tree_cmp))
(tree_get mtree `(5) tree_cmp)

(join `("1" "2" "3" "4"))
(/ (/ 100 10) 2)
(/ 100 (/ 10 2))
(foldr1 / `(100 10 2))
((fold1 . (list join (map tostr _0) flatten)) `(1 2 3 (4 (5 6) 7) 8))
((. join (map (. (concat _0 "_") tostr) _0)) `(1 2 3 4))

(set createTyped (\ t v (list t v)))
(set getType (\ v (head v)))
(set checkType (\ t v (== t (getType v))))

(createTyped Integer 11)
(getType (createTyped Integer 11))
(checkType Integer (createTyped Integer 12))

((. join filter) "123456" (fold1 . (list (== _0 0) (% _0 2) (+ _0 1) tonum)))

(strpad "123" "0" 10)
