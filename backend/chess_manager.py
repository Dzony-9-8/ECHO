import chess
import chess.svg

class ChessManager:
    """
    Manages chess game state using python-chess.
    Ensures legal moves and consistent board rendering.
    """
    def __init__(self):
        self.board = chess.Board()

    def make_move(self, move_str: str) -> bool:
        """
        Attempts to make a move. Supports SAN (e.g., 'e4', 'Nf3') 
        and UCI (e.g., 'e2e4').
        Returns True if successful, False otherwise.
        """
        try:
            # Try parsing as SAN first
            move = self.board.parse_san(move_str)
            self.board.push(move)
            return True
        except ValueError:
            try:
                # Fallback to UCI
                move = self.board.parse_uci(move_str)
                if move in self.board.legal_moves:
                    self.board.push(move)
                    return True
            except ValueError:
                pass
        return False

    def get_board_ascii(self) -> str:
        """
        Returns a clean ASCII board in the format requested by the user.
        """
        # chess.Board.__str__ returns a simple 8x8 grid with one space
        # We need to add the numbers/letters and the formatting
        rows = []
        board_str = str(self.board)
        board_rows = board_str.split('\n')
        
        for i, row in enumerate(board_rows):
            rank = 8 - i
            # Add two spaces after rank number as requested
            rows.append(f"{rank}  {row}")
        
        rows.append("   a b c d e f g h")
        return '\n'.join(rows)

    def reset(self):
        self.board = chess.Board()

    def is_game_over(self) -> bool:
        return self.board.is_game_over()

    def get_last_move_san(self) -> str:
        if not self.board.move_stack:
            return ""
        # To get the SAN of the move just pushed, we need to pop it temporarily 
        # because SAN usually depends on the board state *before* the move.
        # But python-chess's move_stack stores moves.
        last_move = self.board.pop()
        san = self.board.san(last_move)
        self.board.push(last_move)
        return san
