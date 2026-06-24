`timescale 1ns/1ps

module testbench;

    reg a, b, cin;
    wire sum, cout;

    full_adder dut (
        .a(a),
        .b(b),
        .cin(cin),
        .sum(sum),
        .cout(cout)
    );

    initial begin
        $dumpfile("sim.vcd");
        $dumpvars(0, testbench);

        $display("Time\t a b cin | sum cout");
        $monitor("%0t\t %b %b %b | %b %b",
                 $time, a, b, cin, sum, cout);

        a=0; b=0; cin=0; #10;
        a=0; b=0; cin=1; #10;
        a=0; b=1; cin=0; #10;
        a=0; b=1; cin=1; #10;
        a=1; b=0; cin=0; #10;
        a=1; b=0; cin=1; #10;
        a=1; b=1; cin=0; #10;
        a=1; b=1; cin=1; #10;

        $finish;
    end

endmodule