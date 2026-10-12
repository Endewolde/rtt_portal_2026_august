<?php

namespace App\Exceptions;

/**
 * An open defence score was submitted outside its allowed time — before the defence
 * day or after the score deadline. Rendered as a 422 via InvalidScoreException.
 */
class DefenceScoringClosedException extends InvalidScoreException {}
